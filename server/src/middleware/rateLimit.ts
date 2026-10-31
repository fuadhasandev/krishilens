import type { RequestHandler } from 'express'

export function rateLimit(
  maximum: number,
  windowMs: number,
): RequestHandler {
  const requests = new Map<string, { count: number; resetAt: number }>()

  return (request, response, next) => {
    const now = Date.now()
    const key = request.ip ?? 'unknown'
    const current = requests.get(key)
    if (!current || current.resetAt <= now) {
      if (requests.size >= 5_000) {
        for (const [client, entry] of requests) {
          if (entry.resetAt <= now) requests.delete(client)
        }
      }
      requests.set(key, { count: 1, resetAt: now + windowMs })
      next()
      return
    }

    current.count += 1
    if (current.count > maximum) {
      response.status(429).json({
        success: false,
        errorCode: 'RATE_LIMITED',
        error: 'Too many requests. Please wait and try again.',
      })
      return
    }
    next()
  }
}
