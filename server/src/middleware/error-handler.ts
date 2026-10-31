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

  console.error('Unhandled request error:', error)
  response.status(500).json({ error: 'An unexpected server error occurred.' })
}
