import { Router } from 'express'
import multer from 'multer'
import { z } from 'zod'
import { ImageValidationError, processUploadedImage } from '../services/imageProcessing.js'
import { SAM_MODEL, SamServiceError, segmentCropImage } from '../services/sam.js'
import { scanStore } from '../agent/scanStore.js'
import { TemporaryStoreCapacityError } from '../agent/storeErrors.js'

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
    fields: 2,
    parts: 3,
    fieldSize: 100,
  },
})

const segmentRequestSchema = z.object({
  crop: z.enum(['rice', 'wheat', 'maize', 'jute', 'other']).default('rice'),
  target: z
    .enum(['brown spots', 'yellow discolored region', 'damaged leaf region'])
    .default('brown spots'),
}).strict()

export const imagesRouter = Router()
imagesRouter.use((_request, response, next) => {
  response.setHeader('Cache-Control', 'no-store')
  next()
})

imagesRouter.post('/images/segment', upload.single('image'), async (request, response) => {
  if (!request.file) {
    response.status(400).json({
      success: false,
      error: 'Select a JPEG, PNG, or WebP image to analyze.',
    })
    return
  }

  const parsed = segmentRequestSchema.safeParse(request.body)
  if (!parsed.success) {
    response.status(400).json({
      success: false,
      error: 'Choose a supported crop and segmentation target.',
    })
    return
  }

  try {
    const image = await processUploadedImage(request.file.buffer)
    const result = await segmentCropImage(
      image,
      parsed.data.crop,
      parsed.data.target,
    )
    const { scanId, accessToken } = scanStore.create(
      parsed.data.crop,
      parsed.data.target,
      result,
    )
    response.json({ ...result, scanId, scanAccessToken: accessToken })
  } catch (error) {
    if (error instanceof TemporaryStoreCapacityError) {
      response.status(503).json({
        success: false,
        error: 'Temporary scan storage is busy. Please try again later.',
      })
      return
    }

    if (error instanceof ImageValidationError) {
      response.status(400).json({ success: false, error: error.message })
      return
    }

    if (error instanceof SamServiceError) {
      response.status(error.statusCode).json({
        success: false,
        model: SAM_MODEL,
        error: error.message,
        ...(error.requestId ? { requestId: error.requestId } : {}),
      })
      return
    }

    console.error('Image segmentation failed due to an unexpected error.')
    response.status(502).json({
      success: false,
      model: SAM_MODEL,
      error: 'We could not analyze this image right now. Please try again later.',
    })
  }
})
