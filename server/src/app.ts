import cors from 'cors'
import express from 'express'
import { env } from './config/env.js'
import { errorHandler } from './middleware/error-handler.js'
import { aiRouter } from './routes/ai.js'
import { agentRouter } from './routes/agent.js'
import { healthRouter } from './routes/health.js'
import { imagesRouter } from './routes/images.js'

export const app = express()

app.use(cors({ origin: env.clientUrl }))
app.use(express.json({ limit: '1mb' }))
app.use('/api', healthRouter)
app.use('/api', aiRouter)
app.use('/api', imagesRouter)
app.use('/api', agentRouter)
app.use(errorHandler)
