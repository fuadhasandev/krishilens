import multer from 'multer'
import type { ErrorRequestHandler } from 'express'

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  if (error instanceof SyntaxError && 'body' in error) {
    response.status(400).json({ error: 'Invalid JSON request body.' })
    return
  }

  if (
    error instanceof Error &&
    'type' in error &&
    error.type === 'entity.too.large'
  ) {
    response.status(413).json({ error: 'Request body exceeds the 1 MB limit.' })
    return
  }

  if (error instanceof multer.MulterError) {
    const statusCode = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400
    const message =
      error.code === 'LIMIT_FILE_SIZE'
        ? 'Image must be 5 MB or smaller.'
        : 'The image upload is invalid. Upload one image and try again.'
    response.status(statusCode).json({ success: false, error: message })
    return
  }

  console.error('Unhandled request error:', error)
  response.status(500).json({ error: 'An unexpected server error occurred.' })
}
