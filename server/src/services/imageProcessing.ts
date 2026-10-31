import sharp from 'sharp'

type SharpImage = ReturnType<typeof sharp>
type SharpMetadata = Awaited<ReturnType<SharpImage['metadata']>>

const maxInputPixels = 40_000_000
const maxOutputDimension = 2048
const mimeTypes = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
} as const

export class ImageValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ImageValidationError'
  }
}

export interface ProcessedImage {
  buffer: Buffer
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp'
  width: number
  height: number
}

export async function processUploadedImage(
  input: Buffer,
): Promise<ProcessedImage> {
  let image: SharpImage
  let metadata: SharpMetadata

  try {
    image = sharp(input, {
      failOn: 'error',
      limitInputPixels: maxInputPixels,
      sequentialRead: true,
    })
    metadata = await image.metadata()
  } catch {
    throw new ImageValidationError(
      'This image could not be read. Choose a valid JPEG, PNG, or WebP image.',
    )
  }

  const outputFormat = metadata.format
  if (
    outputFormat !== 'jpeg' &&
    outputFormat !== 'png' &&
    outputFormat !== 'webp'
  ) {
    throw new ImageValidationError(
      'Use a JPEG, PNG, or WebP image for analysis.',
    )
  }

  if (
    !metadata.width ||
    !metadata.height ||
    metadata.width * metadata.height > maxInputPixels
  ) {
    throw new ImageValidationError(
      'This image has invalid or unsupported dimensions.',
    )
  }

  if (metadata.pages && metadata.pages > 1) {
    throw new ImageValidationError(
      'Animated images are not supported. Upload a single image instead.',
    )
  }

  try {
    const { data, info } = await image
      .rotate()
      .resize({
        width: maxOutputDimension,
        height: maxOutputDimension,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .toFormat(outputFormat)
      .toBuffer({ resolveWithObject: true })

    return {
      buffer: data,
      mimeType: mimeTypes[outputFormat],
      width: info.width,
      height: info.height,
    }
  } catch {
    throw new ImageValidationError(
      'This image is corrupted or could not be decoded. Please choose another image.',
    )
  }
}
