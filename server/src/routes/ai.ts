import { Router } from 'express'
import { z } from 'zod'
import { investigateCrop } from '../services/cropReasoning.js'
import { META_MODEL, MetaServiceError } from '../services/meta.js'

const analyzeRequestSchema = z.object({
  crop: z.enum(['rice', 'wheat', 'maize', 'jute', 'other']),
  question: z.string().trim().min(3).max(2000),
  language: z.enum(['bn', 'en']),
}).strict()

export const aiRouter = Router()

aiRouter.post('/ai/analyze', async (request, response) => {
  const parsed = analyzeRequestSchema.safeParse(request.body)

  if (!parsed.success) {
    response.status(400).json({
      success: false,
      errorCode: 'INVALID_REQUEST',
      model: META_MODEL,
      answer: 'Please provide a supported crop, a question of 3–2000 characters, and a response language (Bangla or English).',
    })
    return
  }

  try {
    const result = await investigateCrop(parsed.data)
    response.json({
      success: true,
      ...result,
    })
  } catch (error) {
    if (error instanceof MetaServiceError) {
      response.status(error.statusCode).json({
        success: false,
        errorCode: error.statusCode === 429
          ? 'RATE_LIMITED'
          : error.statusCode === 503
            ? 'MODEL_UNAVAILABLE'
            : 'ANALYSIS_FAILED',
        model: META_MODEL,
        answer: error.message,
        ...(error.requestId ? { requestId: error.requestId } : {}),
      })
      return
    }

    console.error('Crop analysis failed due to an unexpected error.')
    response.status(502).json({
      success: false,
      errorCode: 'ANALYSIS_FAILED',
      model: META_MODEL,
      answer: 'We could not complete the analysis right now. Please try again later.',
    })
  }
})
