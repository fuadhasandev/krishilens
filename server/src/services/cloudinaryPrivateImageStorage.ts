import { v2 as cloudinary } from 'cloudinary'
import { Readable } from 'node:stream'
import {
  LocalPrivateImageStorage,
  PrivateImageNotFoundError,
  PrivateImageStorageError,
  type CloudinaryImageReference,
  type PrivateImageReference,
  type PrivateImageStorage,
  type StoredPrivateImage,
} from './privateImageStorage.js'

export interface CloudinaryCredentials {
  cloudName: string
  apiKey: string
  apiSecret: string
}

export interface CloudinaryUploadOptions {
  public_id: string
  resource_type: 'image'
  type: 'authenticated'
  overwrite: false
  unique_filename: false
  use_filename: false
  headers: string
}

export interface CloudinaryUploadResult {
  public_id: string
  asset_id: string
  resource_type: string
  type: string
  format: string
}

type CloudinaryDeliveryType = 'authenticated' | 'private' | 'upload'

export interface CloudinaryGateway {
  upload(
    image: Buffer,
    options: CloudinaryUploadOptions,
  ): Promise<CloudinaryUploadResult>
  privateDownloadUrl(
    publicId: string,
    format: string,
    expiresAt: number,
  ): string
  destroy(
    publicId: string,
    deliveryType?: CloudinaryDeliveryType,
  ): Promise<{ result: string }>
  download(url: string): Promise<Response>
}

class CloudinarySdkGateway implements CloudinaryGateway {
  async upload(
    image: Buffer,
    options: CloudinaryUploadOptions,
  ): Promise<CloudinaryUploadResult> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        options,
        (error, result) => {
          if (error) {
            reject(error)
          } else if (!result) {
            reject(new Error('Cloudinary returned no upload result.'))
          } else {
            const assetId = 'asset_id' in result && typeof result.asset_id === 'string'
              ? result.asset_id
              : ''
            resolve({
              public_id: result.public_id,
              asset_id: assetId,
              resource_type: result.resource_type,
              type: result.type,
              format: result.format,
            })
          }
        },
      )
      uploadStream.once('error', reject)
      uploadStream.end(image)
    })
  }

  privateDownloadUrl(
    publicId: string,
    format: string,
    expiresAt: number,
  ): string {
    return cloudinary.utils.private_download_url(publicId, format, {
      resource_type: 'image',
      type: 'authenticated',
      expires_at: expiresAt,
    })
  }

  async destroy(
    publicId: string,
    deliveryType: CloudinaryDeliveryType = 'authenticated',
  ): Promise<{ result: string }> {
    return cloudinary.uploader.destroy(publicId, {
      resource_type: 'image',
      type: deliveryType,
      invalidate: true,
    })
  }

  download(url: string): Promise<Response> {
    return fetch(url, {
      redirect: 'error',
      signal: AbortSignal.timeout(15_000),
    })
  }
}

const supportedFormats = new Set(['jpg', 'jpeg', 'png', 'webp'])

function isCloudinaryReference(
  reference: PrivateImageReference,
): reference is CloudinaryImageReference {
  return typeof reference !== 'string' &&
    reference.provider === 'cloudinary' &&
    reference.resourceType === 'image' &&
    reference.deliveryType === 'authenticated' &&
    typeof reference.publicId === 'string' &&
    /^krishilens\/(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/){2}[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(reference.publicId) &&
    typeof reference.assetId === 'string' &&
    ['jpg', 'png', 'webp'].includes(reference.format)
}

function contentTypeForFormat(format: string): string {
  if (format === 'jpg' || format === 'jpeg') return 'image/jpeg'
  if (format === 'png') return 'image/png'
  if (format === 'webp') return 'image/webp'
  throw new PrivateImageStorageError('Cloudinary returned an unsupported image format.')
}

function storedFormat(format: string): CloudinaryImageReference['format'] | null {
  if (format === 'jpg' || format === 'jpeg') return 'jpg'
  if (format === 'png') return 'png'
  if (format === 'webp') return 'webp'
  return null
}

function publicIdForKey(key: string): string {
  const match = key.match(
    /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.(jpg|png|webp)$/i,
  )
  if (!match) {
    throw new Error('Invalid private image reference.')
  }
  return `krishilens/${match[1]}/${match[2]}/${match[3]}`
}

export class CloudinaryPrivateImageStorage implements PrivateImageStorage {
  private readonly gateway: CloudinaryGateway

  constructor(
    credentials: CloudinaryCredentials,
    private readonly localStorage = new LocalPrivateImageStorage(),
    gateway?: CloudinaryGateway,
  ) {
    if (!credentials.cloudName || !credentials.apiKey || !credentials.apiSecret) {
      throw new Error(
        'Cloudinary image storage requires CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.',
      )
    }
    cloudinary.config({
      cloud_name: credentials.cloudName,
      api_key: credentials.apiKey,
      api_secret: credentials.apiSecret,
      secure: true,
    })
    this.gateway = gateway ?? new CloudinarySdkGateway()
  }

  async put(
    key: string,
    image: Buffer,
    _contentType?: string,
  ): Promise<CloudinaryImageReference> {
    const publicId = publicIdForKey(key)
    const options: CloudinaryUploadOptions = {
      public_id: publicId,
      resource_type: 'image',
      type: 'authenticated',
      overwrite: false,
      unique_filename: false,
      use_filename: false,
      headers: 'X-Robots-Tag: noindex',
    }
    let result: CloudinaryUploadResult
    try {
      result = await this.gateway.upload(image, options)
    } catch (error) {
      await this.cleanupFailedUpload(publicId, error)
      throw new PrivateImageStorageError('Cloudinary image upload failed.', { cause: error })
    }

    const format = typeof result.format === 'string'
      ? result.format.toLowerCase()
      : ''
    const referenceFormat = storedFormat(format)
    if (
      result.public_id !== publicId ||
      !result.asset_id ||
      result.resource_type !== 'image' ||
      result.type !== 'authenticated' ||
      !supportedFormats.has(format) ||
      !referenceFormat
    ) {
      const cleanupType = result.type === 'authenticated' ||
        result.type === 'private' ||
        result.type === 'upload'
        ? result.type
        : undefined
      await this.cleanupFailedUpload(publicId, undefined, cleanupType)
      throw new PrivateImageStorageError(
        'Cloudinary did not store the image with the required private settings.',
      )
    }

    return {
      provider: 'cloudinary',
      publicId: result.public_id,
      assetId: result.asset_id,
      resourceType: 'image',
      format: referenceFormat,
      deliveryType: 'authenticated',
    }
  }

  async get(reference: PrivateImageReference): Promise<StoredPrivateImage> {
    if (typeof reference === 'string') {
      if (process.env.NODE_ENV === 'production') {
        throw new PrivateImageNotFoundError()
      }
      return this.localStorage.get(reference)
    }
    if (!isCloudinaryReference(reference)) {
      throw new PrivateImageNotFoundError()
    }

    try {
      const expiresAt = Math.floor(Date.now() / 1000) + 60
      const downloadUrl = this.gateway.privateDownloadUrl(
        reference.publicId,
        reference.format,
        expiresAt,
      )
      const parsedUrl = new URL(downloadUrl)
      if (parsedUrl.protocol !== 'https:' || !parsedUrl.hostname.endsWith('.cloudinary.com')) {
        throw new Error('Cloudinary generated an invalid private download URL.')
      }
      const response = await this.gateway.download(downloadUrl)
      if (response.status === 404 || response.status === 410) {
        throw new PrivateImageNotFoundError()
      }
      if (!response.ok || !response.body) {
        throw new PrivateImageStorageError('Cloudinary image retrieval failed.')
      }
      const body = response.body
      return {
        stream: Readable.from((async function* () {
          const reader = body.getReader()
          try {
            while (true) {
              const { done, value } = await reader.read()
              if (done) return
              yield Buffer.from(value)
            }
          } finally {
            reader.releaseLock()
          }
        })()),
        contentType: contentTypeForFormat(reference.format),
      }
    } catch (error) {
      if (error instanceof PrivateImageNotFoundError || error instanceof PrivateImageStorageError) {
        throw error
      }
      throw new PrivateImageStorageError('Cloudinary image retrieval failed.', { cause: error })
    }
  }

  async remove(reference: PrivateImageReference): Promise<void> {
    if (typeof reference === 'string') {
      if (process.env.NODE_ENV === 'production') {
        throw new PrivateImageNotFoundError()
      }
      await this.localStorage.remove(reference)
      return
    }
    if (!isCloudinaryReference(reference)) {
      throw new PrivateImageNotFoundError()
    }

    try {
      const result = await this.gateway.destroy(reference.publicId)
      if (result.result !== 'ok' && result.result !== 'not found') {
        throw new Error('Cloudinary did not confirm image deletion.')
      }
    } catch (error) {
      throw new PrivateImageStorageError('Cloudinary image deletion failed.', { cause: error })
    }
  }

  private async cleanupFailedUpload(
    publicId: string,
    uploadError?: unknown,
    deliveryType?: CloudinaryDeliveryType,
  ): Promise<void> {
    try {
      const deliveryTypes: CloudinaryDeliveryType[] = deliveryType
        ? [deliveryType]
        : ['authenticated', 'upload', 'private']
      for (const candidate of deliveryTypes) {
        const result = await this.gateway.destroy(publicId, candidate)
        if (result.result === 'ok') return
        if (result.result !== 'not found') {
          throw new Error('Cloudinary did not confirm image cleanup.')
        }
      }
    } catch (cleanupError) {
      throw new PrivateImageStorageError(
        'Cloudinary image upload failed and partial-upload cleanup also failed.',
        { cause: new AggregateError([uploadError, cleanupError]) },
      )
    }
  }
}
