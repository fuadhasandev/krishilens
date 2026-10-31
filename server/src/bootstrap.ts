import { connectDatabase } from './config/database.js'
import { env } from './config/env.js'
import { useMongoScanStore } from './agent/scanStore.js'
import { useMongoSessionStore } from './agent/sessionStore.js'
import { assertPrivateStorageConfiguration } from './services/privateImageStorage.js'

let storesInitialized = false

function assertProductionConfiguration(): void {
  if (process.env.NODE_ENV !== 'production') return

  const missing = ['MODEL_API_KEY', 'MONGODB_URI', 'CLIENT_URL'].filter(
    (name) => !process.env[name]?.trim(),
  )
  if (missing.length > 0) {
    throw new Error(
      `Missing required production environment variables: ${missing.join(', ')}.`,
    )
  }
  if (env.imageStorageProvider !== 'cloudinary') {
    throw new Error('Production requires IMAGE_STORAGE_PROVIDER=cloudinary.')
  }

  let clientOrigin: URL
  try {
    clientOrigin = new URL(env.clientUrl)
  } catch {
    throw new Error('CLIENT_URL must be a valid HTTPS origin in production.')
  }
  if (
    clientOrigin.protocol !== 'https:' ||
    clientOrigin.origin !== env.clientUrl.replace(/\/$/, '')
  ) {
    throw new Error('CLIENT_URL must be a valid HTTPS origin in production.')
  }
}

export async function initializeServer(): Promise<void> {
  assertProductionConfiguration()
  assertPrivateStorageConfiguration()
  await connectDatabase()

  if (!storesInitialized) {
    useMongoScanStore()
    useMongoSessionStore()
    storesInitialized = true
  }
}
