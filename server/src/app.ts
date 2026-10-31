import cors from 'cors'
import express from 'express'
import { env } from './config/env.js'
import { errorHandler } from './middleware/error-handler.js'
import { healthRouter } from './routes/health.js'

export const app = express()

app.use(cors({ origin: env.clientUrl }))
app.use(express.json({ limit: '1mb' }))
app.use('/api', healthRouter)
app.use(errorHandler)
