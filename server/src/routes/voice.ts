import { Router, type NextFunction, type Request, type Response } from 'express'
import multer from 'multer'
import { z } from 'zod'
import {
  AudioValidationError,
  MAX_VOICE_UPLOAD_BYTES,
  validatePcmWav,
} from '../services/audioValidation.js'
import { transcribeVoice, VoiceTranscriptionError } from '../services/voiceTranscription.js'
import { rateLimit } from '../middleware/rateLimit.js'
import { scanStore } from '../agent/scanStore.js'
import { sessionStore } from '../agent/sessionStore.js'

const acceptedMimeTypes = new Set([
  'audio/wav',
  'audio/wave',
  'audio/x-wav',
  'audio/vnd.wave',
])

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_VOICE_UPLOAD_BYTES,
    files: 1,
    fields: 3,
    parts: 4,
    fieldSize: 64,
  },
  fileFilter: (_request, file, callback) => {
    callback(null, acceptedMimeTypes.has(file.mimetype.toLowerCase()))
  },
})

const requestSchema = z.object({
  language: z.enum(['en', 'bn']),
  scanId: z.string().uuid().optional(),
  sessionId: z.string().uuid().optional(),
}).strict().refine((value) => !(value.scanId && value.sessionId))

export const voiceRouter = Router()
let activeVoiceRequests = 0
const MAX_ACTIVE_VOICE_REQUESTS = 3
voiceRouter.use((_request, response, next) => {
  response.setHeader('Cache-Control', 'no-store')
  next()
})

function bearerToken(value: string | undefined): string | null {
  return value?.match(/^Bearer ([A-Za-z0-9._~-]{20,200})$/)?.[1] ?? null
}

function uploadAudio(request: Request, response: Response, next: NextFunction): void {
  upload.single('audio')(request, response, (error?: unknown) => {
    if (error instanceof multer.MulterError) {
      const tooLarge = error.code === 'LIMIT_FILE_SIZE'
      response.status(tooLarge ? 413 : 400).json({
        success: false,
        errorCode: tooLarge ? 'AUDIO_TOO_LARGE' : 'INVALID_AUDIO',
        error: tooLarge
          ? 'Audio must be 4 MB or smaller.'
          : 'Upload one supported WAV recording.',
      })
      return
    }
    if (error) {
      next(error)
      return
    }
    next()
  })
}

function limitActiveVoiceRequests(
  _request: Request,
  response: Response,
  next: NextFunction,
): void {
  if (activeVoiceRequests >= MAX_ACTIVE_VOICE_REQUESTS) {
    response.status(429).json({
      success: false,
      errorCode: 'RATE_LIMITED',
      error: 'Speech transcription is busy. Please wait and try again.',
    })
    return
  }

  activeVoiceRequests += 1
  let released = false
  const release = () => {
    if (!released) {
      activeVoiceRequests -= 1
      released = true
    }
  }
  response.once('finish', release)
  response.once('close', release)
  next()
}

voiceRouter.post(
  '/voice/transcribe',
  rateLimit(5, 10 * 60 * 1000),
  limitActiveVoiceRequests,
  uploadAudio,
  async (request, response) => {
    const parsed = requestSchema.safeParse(request.body)
    if (!parsed.success) {
      response.status(400).json({
        success: false,
        errorCode: 'INVALID_REQUEST',
        error: 'Choose English or Bengali and provide at most one valid investigation access context.',
      })
      return
    }

    if (!request.file) {
      response.status(400).json({
        success: false,
        errorCode: 'INVALID_AUDIO',
        error: 'Upload a supported WAV recording.',
      })
      return
    }

    const authContext = parsed.data.scanId ?? parsed.data.sessionId
    if (authContext) {
      const token = bearerToken(request.get('authorization'))
      if (!token) {
        response.status(401).json({
          success: false,
          errorCode: 'UNAUTHORIZED',
          error: 'A valid investigation access token is required.',
        })
        return
      }

      let authorized = false
      if (parsed.data.scanId) {
        authorized = Boolean(await scanStore.getAuthorized(parsed.data.scanId, token))
      } else if (parsed.data.sessionId) {
        authorized = Boolean(await sessionStore.getAuthorized(parsed.data.sessionId, token))
      }
      if (!authorized) {
        response.status(404).json({
          success: false,
          errorCode: 'SESSION_EXPIRED',
          error: 'This investigation is unavailable or its access token is invalid.',
        })
        return
      }
    }

    try {
      validatePcmWav(request.file.buffer)
      const transcript = await transcribeVoice(request.file.buffer, parsed.data.language)
      response.json({ success: true, transcript })
    } catch (error) {
      if (error instanceof AudioValidationError) {
        const statusCode = error.code === 'AUDIO_TOO_LONG' || error.code === 'AUDIO_TOO_LARGE'
          ? 413
          : 400
        response.status(statusCode).json({
          success: false,
          errorCode: error.code,
          error: error.code === 'AUDIO_TOO_LONG'
            ? 'Recordings must be 60 seconds or shorter.'
            : error.code === 'AUDIO_TOO_LARGE'
              ? 'Audio must be 4 MB or smaller.'
              : 'The recording is not valid mono 16-bit PCM WAV audio at 16 or 24 kHz.',
        })
        return
      }

      if (error instanceof VoiceTranscriptionError) {
        const messages = {
          MODEL_UNAVAILABLE: 'Speech transcription is temporarily unavailable. Please try again later.',
          RATE_LIMITED: 'Speech transcription is busy. Please wait and try again.',
          TRANSCRIPTION_FAILED: 'The recording could not be transcribed. Please try again.',
          NO_SPEECH: 'No speech was recognized. Try recording again in a quiet place.',
        }
        response.status(error.statusCode).json({
          success: false,
          errorCode: error.code,
          error: messages[error.code],
        })
        return
      }

      console.error('Voice transcription failed due to an unexpected error.')
      response.status(502).json({
        success: false,
        errorCode: 'TRANSCRIPTION_FAILED',
        error: 'The recording could not be transcribed. Please try again later.',
      })
    }
  },
)
