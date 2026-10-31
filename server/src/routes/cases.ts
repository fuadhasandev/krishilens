import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'
import { Router, type Response } from 'express'
import multer from 'multer'
import { z } from 'zod'
import {
  AnonymousOwnerModel,
  CaseModel,
  InvestigationModel,
  RecheckModel,
  ScanModel,
} from '../models/index.js'
import { rateLimit } from '../middleware/rateLimit.js'
import { ImageValidationError, processUploadedImage } from '../services/imageProcessing.js'
import { explainProgress } from '../services/progressAssessment.js'
import { privateImageStorage } from '../services/privateImageStorage.js'
import { SAM_MODEL, SamServiceError, segmentCropImage } from '../services/sam.js'
import { compareScans, type ComparableScan, type ScanComparison } from '../services/scanComparison.js'

const bearerPattern = /^Bearer ([A-Za-z0-9_-]{40,100})$/
const ownerTokenLifetimeMs = 365 * 24 * 60 * 60 * 1000
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 12, parts: 14, fieldSize: 4096 },
})

const cropSchema = z.enum(['rice', 'wheat', 'maize', 'jute', 'other'])
const languageSchema = z.enum(['bn', 'en'])
const caseIdSchema = z.string().uuid()
const caseCreateSchema = z.object({
  crop: cropSchema,
  language: languageSchema.default('bn'),
}).strict()
const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
}).strict()
const scheduleSchema = z.object({
  nextRecheckAt: z.string().datetime().refine(
    (value) => new Date(value).getTime() > Date.now(),
    'Choose a future re-check date.',
  ).nullable(),
}).strict()
const recheckSchema = z.object({
  language: languageSchema,
  observations: z.string().trim().max(2000).default(''),
  previousScanId: z.string().uuid().optional(),
  similarLighting: z.enum(['true', 'false']).transform((value) => value === 'true').optional(),
  similarAngle: z.enum(['true', 'false']).transform((value) => value === 'true').optional(),
  samePlantRegion: z.enum(['true', 'false']).transform((value) => value === 'true').optional(),
}).strict()

type OwnerContext = { ownerId: string }

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

function caseDto(cropCase: {
  caseId: string
  crop: string
  language: 'bn' | 'en'
  status: string
  createdAt: Date
  updatedAt: Date
  lastScanAt: Date | null
  nextRecheckAt: Date | null
  scanIds: string[]
}) {
  return {
    caseId: cropCase.caseId,
    crop: cropCase.crop,
    language: cropCase.language,
    status: cropCase.status,
    createdAt: cropCase.createdAt,
    updatedAt: cropCase.updatedAt,
    lastScanAt: cropCase.lastScanAt,
    nextRecheckAt: cropCase.nextRecheckAt,
    scanIds: cropCase.scanIds,
    isRecheckOverdue: cropCase.nextRecheckAt !== null &&
      cropCase.nextRecheckAt.getTime() < Date.now(),
  }
}

function tokenMatches(expectedHash: string, token: string): boolean {
  const expected = Buffer.from(expectedHash, 'hex')
  const actual = Buffer.from(hashToken(token), 'hex')
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

function getBearerToken(authorization: string | undefined): string | null {
  const match = authorization?.match(bearerPattern)
  return match?.[1] ?? null
}

async function findOwner(token: string | null): Promise<OwnerContext | null> {
  if (!token) return null
  const tokenHash = hashToken(token)
  const owner = await AnonymousOwnerModel.findOne({
    tokenHash,
    expiresAt: { $gt: new Date() },
  }).lean()
  if (!owner || !tokenMatches(owner.tokenHash, token)) return null
  return { ownerId: owner.ownerId }
}

function pagination(request: { query: Record<string, unknown> }) {
  const parsed = paginationSchema.safeParse({
    page: request.query.page ?? 1,
    limit: request.query.limit ?? 20,
  })
  return parsed.success ? parsed.data : null
}

function sendInvalidRequest(response: Response, errorCode = 'INVALID_REQUEST') {
  response.status(400).json({
    success: false,
    errorCode,
    error: 'The request is invalid. Check the supplied fields and try again.',
  })
}

function scanDto(scan: {
  scanId: string
  image: { width: number; height: number }
  samModel: string
  leafDetected: boolean
  leafPixelCount: number | null
  affectedPixelCount: number | null
  affectedPercent: number | null
  measurementQuality: string
  createdAt: Date
}) {
  return {
    scanId: scan.scanId,
    image: scan.image,
    samModel: scan.samModel,
    leafDetected: scan.leafDetected,
    leafPixelCount: scan.leafPixelCount,
    affectedPixelCount: scan.affectedPixelCount,
    affectedPercent: scan.affectedPercent,
    measurementQuality: scan.measurementQuality,
    createdAt: scan.createdAt,
  }
}

function comparableScan(scan: {
  scanId: string
  affectedPercent: number | null
  measurementQuality: ComparableScan['measurementQuality']
  image: { width: number; height: number }
  imageQuality: ComparableScan['imageQuality']
}): ComparableScan {
  return {
    scanId: scan.scanId,
    affectedPercent: scan.affectedPercent,
    measurementQuality: scan.measurementQuality,
    width: scan.image.width,
    height: scan.image.height,
    imageQuality: scan.imageQuality,
  }
}

export const casesRouter = Router()
casesRouter.use((_request, response, next) => {
  response.setHeader('Cache-Control', 'no-store')
  next()
})
casesRouter.use(rateLimit(120, 15 * 60 * 1000))

casesRouter.post('/cases', rateLimit(20, 10 * 60 * 1000), async (request, response) => {
  const parsed = caseCreateSchema.safeParse(request.body)
  if (!parsed.success) {
    sendInvalidRequest(response)
    return
  }

  let owner = await findOwner(getBearerToken(request.get('authorization')))
  let ownerAccessToken: string | undefined
  if (!owner) {
    if (request.get('authorization')) {
      response.status(401).json({ success: false, errorCode: 'UNAUTHORIZED', error: 'A valid case access token is required.' })
      return
    }
    ownerAccessToken = randomBytes(32).toString('base64url')
    owner = { ownerId: randomUUID() }
    await AnonymousOwnerModel.create({
      ownerId: owner.ownerId,
      tokenHash: hashToken(ownerAccessToken),
      expiresAt: new Date(Date.now() + ownerTokenLifetimeMs),
    })
  }

  const caseId = randomUUID()
  const created = await CaseModel.create({
    caseId,
    ownerId: owner.ownerId,
    crop: parsed.data.crop,
    language: parsed.data.language,
    status: 'active',
    scanIds: [],
    lastScanAt: null,
    nextRecheckAt: null,
  })
  response.status(201).json({
    success: true,
    case: {
      caseId: created.caseId,
      crop: created.crop,
      language: created.language,
      status: created.status,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
      lastScanAt: null,
      nextRecheckAt: null,
      scanIds: [],
      isRecheckOverdue: false,
    },
    ...(ownerAccessToken ? { ownerAccessToken } : {}),
  })
})

casesRouter.get('/cases', async (request, response) => {
  const owner = await findOwner(getBearerToken(request.get('authorization')))
  if (!owner) {
    response.status(401).json({ success: false, errorCode: 'UNAUTHORIZED', error: 'A valid case access token is required.' })
    return
  }
  const page = pagination(request)
  if (!page) {
    sendInvalidRequest(response)
    return
  }
  const filter = { ownerId: owner.ownerId }
  const [cases, total] = await Promise.all([
    CaseModel.find(filter).sort({ updatedAt: -1 }).skip((page.page - 1) * page.limit).limit(page.limit).lean(),
    CaseModel.countDocuments(filter),
  ])
  response.json({
    success: true,
    cases: cases.map(caseDto),
    page: page.page,
    limit: page.limit,
    total,
  })
})

casesRouter.get('/cases/:caseId', async (request, response) => {
  const owner = await findOwner(getBearerToken(request.get('authorization')))
  if (!owner) {
    response.status(401).json({ success: false, errorCode: 'UNAUTHORIZED', error: 'A valid case access token is required.' })
    return
  }
  const caseId = caseIdSchema.safeParse(request.params.caseId)
  if (!caseId.success) {
    response.status(404).json({ success: false, errorCode: 'CASE_NOT_FOUND', error: 'This case is unavailable.' })
    return
  }
  const cropCase = await CaseModel.findOne({ caseId: caseId.data, ownerId: owner.ownerId }).lean()
  if (!cropCase) {
    response.status(404).json({ success: false, errorCode: 'CASE_NOT_FOUND', error: 'This case is unavailable.' })
    return
  }
  const [scans, investigations, rechecks] = await Promise.all([
    ScanModel.find({ caseId: cropCase.caseId, ownerId: owner.ownerId }).sort({ createdAt: -1 }).limit(50).lean(),
    InvestigationModel.find({ caseId: cropCase.caseId, ownerId: owner.ownerId })
      .select('investigationId caseId farmerQuestion agentStatus report evidenceSourceIds language createdAt updatedAt')
      .sort({ createdAt: -1 }).limit(50).lean(),
    RecheckModel.find({ caseId: cropCase.caseId, ownerId: owner.ownerId }).sort({ completedAt: -1 }).limit(50).lean(),
  ])
  response.json({
    success: true,
    case: caseDto(cropCase),
    scans: scans.map(scanDto),
    investigations,
    rechecks,
  })
})

casesRouter.get('/cases/:caseId/scans', async (request, response) => {
  const owner = await findOwner(getBearerToken(request.get('authorization')))
  if (!owner) {
    response.status(401).json({ success: false, errorCode: 'UNAUTHORIZED', error: 'A valid case access token is required.' })
    return
  }
  const caseId = caseIdSchema.safeParse(request.params.caseId)
  const page = pagination(request)
  if (!caseId.success || !page) {
    sendInvalidRequest(response)
    return
  }
  const filter = { caseId: caseId.data, ownerId: owner.ownerId }
  if (!(await CaseModel.exists(filter))) {
    response.status(404).json({ success: false, errorCode: 'CASE_NOT_FOUND', error: 'This case is unavailable.' })
    return
  }
  const [scans, total] = await Promise.all([
    ScanModel.find(filter).sort({ createdAt: -1 }).skip((page.page - 1) * page.limit).limit(page.limit).lean(),
    ScanModel.countDocuments(filter),
  ])
  response.json({ success: true, scans: scans.map(scanDto), page: page.page, limit: page.limit, total })
})

casesRouter.get('/cases/:caseId/investigations', async (request, response) => {
  const owner = await findOwner(getBearerToken(request.get('authorization')))
  if (!owner) {
    response.status(401).json({ success: false, errorCode: 'UNAUTHORIZED', error: 'A valid case access token is required.' })
    return
  }
  const caseId = caseIdSchema.safeParse(request.params.caseId)
  const page = pagination(request)
  if (!caseId.success || !page) {
    sendInvalidRequest(response)
    return
  }
  const filter = { caseId: caseId.data, ownerId: owner.ownerId }
  if (!(await CaseModel.exists(filter))) {
    response.status(404).json({ success: false, errorCode: 'CASE_NOT_FOUND', error: 'This case is unavailable.' })
    return
  }
  const [investigations, total] = await Promise.all([
    InvestigationModel.find(filter)
      .select('investigationId caseId farmerQuestion agentStatus report evidenceSourceIds language createdAt updatedAt')
      .sort({ createdAt: -1 }).skip((page.page - 1) * page.limit).limit(page.limit).lean(),
    InvestigationModel.countDocuments(filter),
  ])
  response.json({ success: true, investigations, page: page.page, limit: page.limit, total })
})

casesRouter.patch('/cases/:caseId/recheck-date', async (request, response) => {
  const owner = await findOwner(getBearerToken(request.get('authorization')))
  if (!owner) {
    response.status(401).json({ success: false, errorCode: 'UNAUTHORIZED', error: 'A valid case access token is required.' })
    return
  }
  const caseId = caseIdSchema.safeParse(request.params.caseId)
  const body = scheduleSchema.safeParse(request.body)
  if (!caseId.success || !body.success) {
    sendInvalidRequest(response)
    return
  }
  const cropCase = await CaseModel.findOneAndUpdate(
    { caseId: caseId.data, ownerId: owner.ownerId },
    { $set: { nextRecheckAt: body.data.nextRecheckAt ? new Date(body.data.nextRecheckAt) : null } },
    { new: true },
  ).lean()
  if (!cropCase) {
    response.status(404).json({ success: false, errorCode: 'CASE_NOT_FOUND', error: 'This case is unavailable.' })
    return
  }
  response.json({
    success: true,
    nextRecheckAt: cropCase.nextRecheckAt,
    isRecheckOverdue: cropCase.nextRecheckAt !== null &&
      cropCase.nextRecheckAt.getTime() < Date.now(),
  })
})

casesRouter.get('/cases/:caseId/scans/:scanId/image', async (request, response) => {
  const owner = await findOwner(getBearerToken(request.get('authorization')))
  if (!owner) {
    response.status(401).json({ success: false, errorCode: 'UNAUTHORIZED', error: 'A valid case access token is required.' })
    return
  }
  const caseId = caseIdSchema.safeParse(request.params.caseId)
  const scanId = caseIdSchema.safeParse(request.params.scanId)
  if (!caseId.success || !scanId.success) {
    response.status(404).json({ success: false, errorCode: 'SCAN_NOT_FOUND', error: 'This scan is unavailable.' })
    return
  }
  const scan = await ScanModel.findOne({
    caseId: caseId.data,
    scanId: scanId.data,
    ownerId: owner.ownerId,
  }).lean()
  if (!scan) {
    response.status(404).json({ success: false, errorCode: 'SCAN_NOT_FOUND', error: 'This scan is unavailable.' })
    return
  }
  try {
    const buffer = await privateImageStorage.get(scan.imageRef)
    response.type(scan.imageRef.endsWith('.jpg') ? 'image/jpeg' : scan.imageRef.endsWith('.png') ? 'image/png' : 'image/webp')
    response.setHeader('Content-Security-Policy', "default-src 'none'; sandbox")
    response.send(buffer)
  } catch {
    response.status(404).json({ success: false, errorCode: 'IMAGE_NOT_FOUND', error: 'The saved image is unavailable.' })
  }
})

casesRouter.post(
  '/cases/:caseId/recheck',
  rateLimit(5, 10 * 60 * 1000),
  upload.single('image'),
  async (request, response) => {
    const owner = await findOwner(getBearerToken(request.get('authorization')))
    if (!owner) {
      response.status(401).json({ success: false, errorCode: 'UNAUTHORIZED', error: 'A valid case access token is required.' })
      return
    }
    const caseId = caseIdSchema.safeParse(request.params.caseId)
    const body = recheckSchema.safeParse(request.body)
    const submissionId = z.string().uuid().safeParse(request.get('idempotency-key'))
    if (!caseId.success || !body.success || !submissionId.success || !request.file) {
      sendInvalidRequest(response, 'INVALID_REQUEST')
      return
    }

    const existing = await RecheckModel.findOne({
      submissionId: submissionId.data,
      caseId: caseId.data,
      ownerId: owner.ownerId,
    }).lean()
    if (existing) {
      response.json({ success: true, recheck: existing, duplicate: true })
      return
    }

    const cropCase = await CaseModel.findOne({
      caseId: caseId.data,
      ownerId: owner.ownerId,
    }).lean()
    if (!cropCase) {
      response.status(404).json({ success: false, errorCode: 'CASE_NOT_FOUND', error: 'This case is unavailable.' })
      return
    }

    let image
    try {
      image = await processUploadedImage(request.file.buffer)
    } catch (error) {
      if (error instanceof ImageValidationError) {
        response.status(400).json({ success: false, errorCode: 'INVALID_IMAGE', error: error.message })
        return
      }
      throw error
    }

    const scanId = randomUUID()
    const recheckId = randomUUID()
    const extension = image.mimeType === 'image/jpeg' ? 'jpg' : image.mimeType === 'image/png' ? 'png' : 'webp'
    const imageRef = `${owner.ownerId}/${cropCase.caseId}/${scanId}.${extension}`
    let storedImage = false
    try {
      const analysis = await segmentCropImage(image, cropCase.crop, 'brown spots')
      await privateImageStorage.put(imageRef, image.buffer)
      storedImage = true
      const priorScanFilter = {
        caseId: cropCase.caseId,
        ownerId: owner.ownerId,
        ...(body.data.previousScanId ? { scanId: body.data.previousScanId } : {}),
      }
      const previous = await ScanModel.findOne(priorScanFilter)
        .sort({ createdAt: -1 })
        .lean()
      if (body.data.previousScanId && !previous) {
        await privateImageStorage.remove(imageRef)
        response.status(404).json({ success: false, errorCode: 'PREVIOUS_SCAN_NOT_FOUND', error: 'The selected comparison scan is unavailable.' })
        return
      }

      const currentScanQuality = {
        similarLighting: body.data.similarLighting ?? null,
        similarAngle: body.data.similarAngle ?? null,
        samePlantRegion: body.data.samePlantRegion ?? null,
      }
      const scanRecord = {
        scanId,
        caseId: cropCase.caseId,
        ownerId: owner.ownerId,
        imageRef,
        image: { width: image.width, height: image.height },
        samModel: SAM_MODEL,
        leafDetected: analysis.leaf.detected,
        leafPixelCount: analysis.leaf.pixelCount,
        affectedPixelCount: analysis.affectedArea.pixelCount,
        affectedPercent: analysis.affectedArea.percentage,
        measurementQuality: analysis.affectedArea.status,
        imageQuality: currentScanQuality,
        createdAt: new Date(),
      }
      const comparison: ScanComparison | null = previous
        ? compareScans(
          comparableScan(previous),
          comparableScan({
            ...scanRecord,
            measurementQuality: scanRecord.measurementQuality,
            imageQuality: currentScanQuality,
          }),
        )
        : null
      const assessment = await explainProgress(comparison, body.data.observations, body.data.language)

      await ScanModel.create(scanRecord)
      const recheck = await RecheckModel.create({
        recheckId,
        submissionId: submissionId.data,
        caseId: cropCase.caseId,
        ownerId: owner.ownerId,
        previousScanId: previous?.scanId ?? null,
        currentScanId: scanId,
        intendedDate: cropCase.nextRecheckAt,
        completedAt: new Date(),
        observations: body.data.observations,
        comparison,
        assessment: { ...assessment, language: body.data.language },
        status: 'completed',
      })
      await CaseModel.updateOne(
        { caseId: cropCase.caseId, ownerId: owner.ownerId },
        {
          $addToSet: { scanIds: scanId },
          $set: {
            lastScanAt: new Date(),
            nextRecheckAt: null,
            language: body.data.language,
          },
        },
      )

      response.status(201).json({
        success: true,
        recheck: recheck.toObject(),
        scan: scanDto(scanRecord),
        comparison,
      })
    } catch (error) {
      const cleanupResults = await Promise.allSettled([
        ...(storedImage ? [privateImageStorage.remove(imageRef)] : []),
        ScanModel.deleteOne({ scanId, ownerId: owner.ownerId }),
        RecheckModel.deleteOne({ recheckId, ownerId: owner.ownerId }),
      ])
      for (const result of cleanupResults) {
        if (result.status === 'rejected') {
          console.error('Re-check rollback cleanup failed.', {
            errorName: result.reason instanceof Error ? result.reason.name : 'UnknownError',
          })
        }
      }
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 11000
      ) {
        const duplicate = await RecheckModel.findOne({
          submissionId: submissionId.data,
          caseId: caseId.data,
          ownerId: owner.ownerId,
        }).lean()
        if (duplicate) {
          response.json({ success: true, recheck: duplicate, duplicate: true })
          return
        }
      }
      if (error instanceof SamServiceError) {
        response.status(error.statusCode).json({
          success: false,
          errorCode: error.statusCode === 503 ? 'MODEL_UNAVAILABLE' : error.statusCode === 429 ? 'RATE_LIMITED' : 'ANALYSIS_FAILED',
          error: error.message,
        })
        return
      }
      console.error('Re-check processing failed.')
      response.status(503).json({
        success: false,
        errorCode: 'PERSISTENCE_FAILED',
        error: 'The re-check could not be saved. Please try again.',
      })
    }
  },
)
