import { config } from 'dotenv'
import { fileURLToPath } from 'node:url'

config({ path: fileURLToPath(new URL('../../.env', import.meta.url)) })

function parsePort(value: string | undefined): number {
  if (value === undefined) {
    return 3000
  }

  const port = Number(value)
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535.')
  }

  return port
}

function parseImageStorageProvider(value: string | undefined): 'local' | 'cloudinary' {
  if (value === undefined || value === '') {
    return 'local'
  }
  if (value === 'local' || value === 'cloudinary') {
    return value
  }
  throw new Error('IMAGE_STORAGE_PROVIDER must be either "local" or "cloudinary".')
}

export const env = {
  port: parsePort(process.env.PORT),
  clientUrl: process.env.CLIENT_URL ?? 'http://localhost:5173',
  imageStorageProvider: parseImageStorageProvider(process.env.IMAGE_STORAGE_PROVIDER),
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME?.trim() ?? '',
    apiKey: process.env.CLOUDINARY_API_KEY?.trim() ?? '',
    apiSecret: process.env.CLOUDINARY_API_SECRET?.trim() ?? '',
  },
}
