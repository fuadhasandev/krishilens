import { app } from './app.js'
import { initializeServer } from './bootstrap.js'
import { env } from './config/env.js'

try {
  await initializeServer()
  app.listen(env.port, () => {
    console.log(`KrishiLens API listening on port ${env.port}; MongoDB connected.`)
  })
} catch (error) {
  const message = error instanceof Error ? error.message : 'Unknown startup error.'
  console.error(`KrishiLens API startup failed: ${message}`)
  process.exitCode = 1
}
