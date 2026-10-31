import { app } from './app.js'
import { connectDatabase } from './config/database.js'
import { env } from './config/env.js'
import { useMongoScanStore } from './agent/scanStore.js'
import { useMongoSessionStore } from './agent/sessionStore.js'
import { assertPrivateStorageConfiguration } from './services/privateImageStorage.js'

try {
  assertPrivateStorageConfiguration()
  await connectDatabase()
  useMongoScanStore()
  useMongoSessionStore()
  app.listen(env.port, () => {
    console.log(`KrishiLens API listening on port ${env.port}; MongoDB connected.`)
  })
} catch (error) {
  const message = error instanceof Error ? error.message : 'Unknown startup error.'
  console.error(`KrishiLens API startup failed: ${message}`)
  process.exitCode = 1
}
