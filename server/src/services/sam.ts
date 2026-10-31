import OpenAI, {
  APIError,
  APIConnectionError,
  APIConnectionTimeoutError,
} from 'openai'
import {
  decodeMaskToRaster,
  frameIndexOf,
  parseImageStream,
  recordsOfKind,
  type SegmentationMaskRecord,
} from '@meta-sam/parser'
import sharp from 'sharp'
import { calculateAffectedArea, unionMasks, type BinaryMask } from './damageCalculator.js'
import type { ProcessedImage } from './imageProcessing.js'

export const SAM_MODEL = 'sam-3.1'

const baseURL = process.env.META_BASE_URL?.trim() || 'https://api.meta.ai/v1'

export class SamServiceError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
    readonly requestId?: string,
  ) {
    super(message)
    this.name = 'SamServiceError'
  }
}

export interface SamObject {
  id: string
  label: string
  boundingBox: number[]
  confidence?: number
}

export interface SamAnalysis {
  success: true
  model: typeof SAM_MODEL
  image: { width: number; height: number }
  leaf: { detected: boolean; pixelCount: number | null }
  affectedArea: {
    pixelCount: number | null
    percentage: number | null
    status: 'accepted' | 'needs_review' | 'unavailable'
  }
  objects: SamObject[]
  overlay: { imageUrl: string | null }
  requestIds: string[]
  warning?: string
}

interface ConceptResult {
  masks: BinaryMask[]
  objects: SamObject[]
  requestIds: string[]
  invalidMask: boolean
  requiresReview: boolean
  warnings: string[]
}

interface ConceptRequest {
  image: ProcessedImage
  prompt: string
  label: string
}

function createClient(): OpenAI {
  const apiKey = process.env.MODEL_API_KEY?.trim()
  if (!apiKey) {
    throw new SamServiceError(
      'Image analysis is not configured yet. Please try again later.',
      503,
    )
  }

  return new OpenAI({
    apiKey,
    baseURL,
    timeout: 90_000,
    maxRetries: 0,
  })
}

function rootCause(error: unknown): unknown {
  let current = error
  for (let depth = 0; depth < 4; depth += 1) {
    if (
      current instanceof Error &&
      'cause' in current &&
      current.cause !== undefined
    ) {
      current = current.cause
      continue
    }
    return current
  }
  return current
}

export function mapSamProviderError(error: unknown): SamServiceError {
  const cause = rootCause(error)
  if (cause instanceof APIConnectionTimeoutError) {
    return new SamServiceError(
      'Image segmentation took too long. Please try again.',
      504,
    )
  }
  if (cause instanceof APIError && cause.status !== undefined) {
    const requestId = cause.requestID ?? undefined
    if (cause.status === 429) {
      return new SamServiceError(
        'The image analysis service is busy. Please wait and try again.',
        429,
        requestId,
      )
    }
    return new SamServiceError(
      'The image analysis service could not complete this request.',
      502,
      requestId,
    )
  }
  if (cause instanceof APIConnectionError) {
    return new SamServiceError(
      'Could not reach the image analysis service. Please try again later.',
      502,
    )
  }
  return new SamServiceError(
    'The image analysis service returned an unreadable result. Please try again.',
    502,
  )
}

function placeMaskInImage(
  record: SegmentationMaskRecord,
  width: number,
  height: number,
): BinaryMask | null {
  const { left, top, right, bottom } = record.bounds
  const boundsWidth = right - left
  const boundsHeight = bottom - top
  const { mask } = record

  if (
    !Number.isInteger(left) ||
    !Number.isInteger(top) ||
    !Number.isInteger(right) ||
    !Number.isInteger(bottom) ||
    left < 0 ||
    top < 0 ||
    right > width ||
    bottom > height ||
    boundsWidth <= 0 ||
    boundsHeight <= 0 ||
    mask.width <= 0 ||
    mask.height <= 0 ||
    mask.width * mask.height > width * height
  ) {
    return null
  }

  let raster: Uint8Array
  try {
    raster = decodeMaskToRaster(mask)
  } catch {
    return null
  }

  if (
    raster.length !== mask.width * mask.height ||
    raster.some((pixel) => pixel !== 0 && pixel !== 1)
  ) {
    return null
  }

  const pixels = new Uint8Array(width * height)
  for (let y = top; y < bottom; y += 1) {
    const sourceY = Math.min(
      mask.height - 1,
      Math.floor(((y - top) * mask.height) / boundsHeight),
    )
    for (let x = left; x < right; x += 1) {
      const sourceX = Math.min(
        mask.width - 1,
        Math.floor(((x - left) * mask.width) / boundsWidth),
      )
      pixels[y * width + x] = raster[sourceY * mask.width + sourceX]!
    }
  }

  return { width, height, pixels }
}

async function requestConcept({
  image,
  prompt,
  label,
}: ConceptRequest): Promise<ConceptResult> {
  const client = createClient()
  let requestId: string | undefined
  const imageUrl = `data:${image.mimeType};base64,${image.buffer.toString('base64')}`

  try {
    const responseStream = await client.responses.create({
      model: SAM_MODEL,
      input: [
        {
          type: 'message',
          role: 'user',
          content: [
            { type: 'input_text', text: prompt },
            { type: 'input_image', image_url: imageUrl, detail: 'auto' },
          ],
        },
      ],
      stream: true,
      metadata: { mask_encoding: 'one_bit' },
    })

    const trackedEvents = (async function* () {
      for await (const event of responseStream) {
        if (event.type === 'response.created') {
          requestId = event.response.id
        }
        yield event
      }
    })()
    const result = await parseImageStream(trackedEvents).finalResult
    if (result.outcome.status !== 'completed') {
      throw new SamServiceError(
        'Image segmentation did not finish. Please try again.',
        502,
        requestId,
      )
    }

    const warnings = result.diagnostics.map(
      (diagnostic) => diagnostic.message,
    )
    const maskRecords = recordsOfKind(result.records, 'mask').filter(
      (record) => frameIndexOf(record) === undefined || frameIndexOf(record) === 0,
    )
    const masks: BinaryMask[] = []
    const objects: SamObject[] = []
    let invalidMask = false

    for (const record of maskRecords) {
      const placed = placeMaskInImage(record, image.width, image.height)
      if (!placed) {
        invalidMask = true
        continue
      }

      masks.push(placed)
      objects.push({
        id: `${label}:${record.objectId}`,
        label,
        boundingBox: [
          record.bounds.left,
          record.bounds.top,
          record.bounds.right,
          record.bounds.bottom,
        ],
        ...(record.confidence !== undefined
          ? { confidence: record.confidence }
          : {}),
      })
    }

    if (invalidMask) {
      warnings.push('One or more segmentation masks failed validation.')
    }

    return {
      masks,
      objects,
      requestIds: requestId ? [requestId] : [],
      invalidMask,
      requiresReview: warnings.length > 0 || invalidMask,
      warnings,
    }
  } catch (error) {
    if (error instanceof SamServiceError) {
      throw error
    }
    throw mapSamProviderError(error)
  }
}

function countMaskPixels(mask: Uint8Array): number {
  let count = 0
  for (const pixel of mask) {
    count += pixel
  }
  return count
}

export async function renderSegmentationOverlay(
  width: number,
  height: number,
  leaf: Uint8Array,
  affected: Uint8Array,
): Promise<string> {
  const rgba = Buffer.alloc(width * height * 4)

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x
      const offset = index * 4
      if (affected[index] === 1) {
        rgba[offset] = 242
        rgba[offset + 1] = 112
        rgba[offset + 2] = 40
        rgba[offset + 3] = 145
        continue
      }

      if (leaf[index] !== 1) {
        continue
      }

      const edge =
        x === 0 ||
        y === 0 ||
        x === width - 1 ||
        y === height - 1 ||
        leaf[index - 1] !== 1 ||
        leaf[index + 1] !== 1 ||
        leaf[index - width] !== 1 ||
        leaf[index + width] !== 1

      if (edge) {
        rgba[offset] = 32
        rgba[offset + 1] = 160
        rgba[offset + 2] = 93
        rgba[offset + 3] = 235
      }
    }
  }

  const png = await sharp(rgba, {
    raw: { width, height, channels: 4 },
  })
    .png()
    .toBuffer()
  return `data:image/png;base64,${png.toString('base64')}`
}

export async function segmentCropImage(
  image: ProcessedImage,
  crop: string,
  target: string,
): Promise<SamAnalysis> {
  const leafLabel = `${crop} leaf`
  const cropSpecificLeaf = await requestConcept({
    image,
    prompt: leafLabel,
    label: leafLabel,
  })
  let leafResult = cropSpecificLeaf
  if (cropSpecificLeaf.masks.length === 0 && !cropSpecificLeaf.invalidMask) {
    const genericLeaf = await requestConcept({
      image,
      prompt: 'leaf',
      label: leafLabel,
    })
    leafResult = {
      ...genericLeaf,
      requestIds: [...cropSpecificLeaf.requestIds, ...genericLeaf.requestIds],
      warnings: [
        ...cropSpecificLeaf.warnings,
        ...genericLeaf.warnings,
        'The crop-specific leaf prompt found no match; a generic leaf prompt was tried.',
      ],
      requiresReview:
        cropSpecificLeaf.requiresReview || genericLeaf.requiresReview,
    }
  }
  const leafUnion = unionMasks(leafResult.masks, image.width, image.height)
  const leafPixelCount = leafUnion ? countMaskPixels(leafUnion) : 0
  const leafDetected = leafPixelCount > 0
  const requestIds = [...leafResult.requestIds]

  let affectedResult: ConceptResult = {
    masks: [],
    objects: [],
    invalidMask: false,
    requiresReview: false,
    requestIds: [],
    warnings: [],
  }
  if (leafDetected) {
    affectedResult = await requestConcept({
      image,
      prompt: target,
      label: target,
    })
    requestIds.push(...affectedResult.requestIds)
  }

  const affectedUnion =
    affectedResult.masks.length > 0
      ? unionMasks(affectedResult.masks, image.width, image.height)
      : new Uint8Array(image.width * image.height)
  const measurement = calculateAffectedArea(
    image.width,
    image.height,
    leafResult.masks,
    affectedResult.masks,
  )
  const warnings = [...leafResult.warnings, ...affectedResult.warnings]
  const uncertain =
    leafResult.requiresReview ||
    affectedResult.requiresReview ||
    measurement.status === 'needs_review'

  const overlay = leafUnion
    ? await renderSegmentationOverlay(
        image.width,
        image.height,
        leafUnion,
        affectedUnion ?? new Uint8Array(image.width * image.height),
      )
    : null

  const finalMeasurement = uncertain
    ? {
        ...measurement,
        affectedPixelCount: null,
        percentage: null,
        status: 'needs_review' as const,
      }
    : measurement
  const statusWarning = !leafDetected
    ? `No ${crop} leaf mask could be validated. No area estimate is available.`
    : affectedResult.masks.length === 0
      ? `No "${target}" region was segmented. No affected-area estimate is available.`
      : uncertain
        ? 'Some segmentation output could not be validated. Review the image; no area estimate is shown.'
        : 'Candidate regions are visual segmentation only, not a crop disease diagnosis. Confirm observations with a qualified agricultural officer.'
  const warning = [...warnings, statusWarning].filter(Boolean).join(' ')

  return {
    success: true,
    model: SAM_MODEL,
    image: { width: image.width, height: image.height },
    leaf: {
      detected: leafDetected,
      pixelCount: leafDetected && !leafResult.invalidMask ? leafPixelCount : null,
    },
    affectedArea: {
      pixelCount: finalMeasurement.affectedPixelCount,
      percentage: finalMeasurement.percentage,
      status:
        !leafDetected || affectedResult.masks.length === 0
          ? 'unavailable'
          : finalMeasurement.status,
    },
    objects: [...leafResult.objects, ...affectedResult.objects],
    overlay: { imageUrl: overlay },
    requestIds,
    warning,
  }
}
