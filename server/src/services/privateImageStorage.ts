import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

export interface PrivateImageStorage {
  put(key: string, image: Buffer): Promise<void>
  get(key: string): Promise<Buffer>
  remove(key: string): Promise<void>
}

export function assertPrivateStorageConfiguration(): void {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'Production private image storage is not configured. Add a private cloud storage adapter before deploying.',
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

export class LocalPrivateImageStorage implements PrivateImageStorage {
  constructor(
    private readonly root = resolve(
      process.env.LOCAL_IMAGE_STORAGE_DIR ?? 'data/private-images',
    ),
  ) {}

  async put(key: string, image: Buffer): Promise<void> {
    const filePath = safePath(this.root, key)
    await mkdir(dirname(filePath), { recursive: true, mode: 0o700 })
    await writeFile(filePath, image, { mode: 0o600, flag: 'wx' })
  }

  async get(key: string): Promise<Buffer> {
    return readFile(safePath(this.root, key))
  }

  async remove(key: string): Promise<void> {
    await rm(safePath(this.root, key), { force: true })
  }
}

export const privateImageStorage: PrivateImageStorage =
  new LocalPrivateImageStorage()
