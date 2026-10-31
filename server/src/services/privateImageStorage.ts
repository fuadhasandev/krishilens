import { createReadStream } from 'node:fs'
import { access, mkdir, rm, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import type { Readable } from 'node:stream'
import { env } from '../config/env.js'
import { CloudinaryPrivateImageStorage } from './cloudinaryPrivateImageStorage.js'

export interface CloudinaryImageReference {
  provider: 'cloudinary'
  publicId: string
  assetId: string
  resourceType: 'image'
  format: 'jpg' | 'png' | 'webp'
  deliveryType: 'authenticated'
}

export type PrivateImageReference = string | CloudinaryImageReference

export interface StoredPrivateImage {
  stream: Readable
  contentType: string
}

export interface PrivateImageStorage {
  put(
    key: string,
    image: Buffer,
    contentType?: string,
  ): Promise<PrivateImageReference>
  get(reference: PrivateImageReference): Promise<StoredPrivateImage>
  remove(reference: PrivateImageReference): Promise<void>
}

export class PrivateImageNotFoundError extends Error {
  constructor() {
    super('The stored image is unavailable.')
    this.name = 'PrivateImageNotFoundError'
  }
}

export class PrivateImageStorageError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'PrivateImageStorageError'
  }
}

export function assertPrivateStorageConfiguration(): void {
  if (
    env.imageStorageProvider === 'local' &&
    process.env.NODE_ENV !== undefined &&
    process.env.NODE_ENV !== 'development' &&
    process.env.NODE_ENV !== 'test'
  ) {
    throw new Error(
      'Local image storage is development-only. Set IMAGE_STORAGE_PROVIDER=cloudinary for this environment.',
    )
  }
  if (
    env.imageStorageProvider === 'cloudinary' &&
    (!env.cloudinary.cloudName || !env.cloudinary.apiKey || !env.cloudinary.apiSecret)
  ) {
    throw new Error(
      'Cloudinary image storage requires CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.',
    )
  }
}

function safePath(root: string, key: string): string {
  if (!/^[a-f0-9-]+\/[a-f0-9-]+\/[a-f0-9-]+\.(?:jpg|png|webp)$/.test(key)) {
    throw new Error('Invalid private image reference.')
  }
  const resolvedRoot = resolve(root)
  const filePath = resolve(resolvedRoot, key)
  if (!filePath.startsWith(`${resolvedRoot}/`)) {
    throw new Error('Invalid private image reference.')
  }
  return filePath
}

function mimeTypeForKey(key: string): string {
  if (key.endsWith('.jpg')) return 'image/jpeg'
  if (key.endsWith('.png')) return 'image/png'
  if (key.endsWith('.webp')) return 'image/webp'
  throw new Error('Invalid private image reference.')
}

export class LocalPrivateImageStorage implements PrivateImageStorage {
  constructor(
    private readonly root = resolve(
      process.env.LOCAL_IMAGE_STORAGE_DIR ?? 'data/private-images',
    ),
  ) {}

  async put(
    key: string,
    image: Buffer,
    _contentType?: string,
  ): Promise<string> {
    const filePath = safePath(this.root, key)
    await mkdir(dirname(filePath), { recursive: true, mode: 0o700 })
    await writeFile(filePath, image, { mode: 0o600, flag: 'wx' })
    return key
  }

  async get(reference: PrivateImageReference): Promise<StoredPrivateImage> {
    if (typeof reference !== 'string') {
      throw new PrivateImageNotFoundError()
    }
    const key = reference
    const filePath = safePath(this.root, key)
    try {
      await access(filePath)
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
        throw new PrivateImageNotFoundError()
      }
      throw new PrivateImageStorageError('Local image storage could not be read.', { cause: error })
    }
    return { stream: createReadStream(filePath), contentType: mimeTypeForKey(key) }
  }

  async remove(reference: PrivateImageReference): Promise<void> {
    if (typeof reference !== 'string') {
      throw new PrivateImageNotFoundError()
    }
    const key = reference
    try {
      await rm(safePath(this.root, key), { force: true })
    } catch (error) {
      throw new PrivateImageStorageError('Local image storage could not be updated.', { cause: error })
    }
  }
}

export function createPrivateImageStorage(): PrivateImageStorage {
  assertPrivateStorageConfiguration()
  if (env.imageStorageProvider === 'cloudinary') {
    return new CloudinaryPrivateImageStorage(
      env.cloudinary,
      new LocalPrivateImageStorage(),
    )
  }
  return new LocalPrivateImageStorage()
}

let storage: PrivateImageStorage | undefined

function getStorage(): PrivateImageStorage {
  storage ??= createPrivateImageStorage()
  return storage
}

export const privateImageStorage: PrivateImageStorage = {
  put: (key, image, contentType) => getStorage().put(key, image, contentType),
  get: (reference) => getStorage().get(reference),
  remove: (reference) => getStorage().remove(reference),
}
