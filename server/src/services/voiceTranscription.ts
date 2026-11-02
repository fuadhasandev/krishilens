import { randomBytes } from 'node:crypto'
import { z } from 'zod'

export const VOICE_MODEL = 'muse-voice-transcribe-1.0'

export class VoiceTranscriptionError extends Error {
  constructor(
    readonly code:
      | 'MODEL_UNAVAILABLE'
      | 'RATE_LIMITED'
      | 'TRANSCRIPTION_FAILED'
      | 'NO_SPEECH',
    readonly statusCode: number,
  ) {
    super(code)
    this.name = 'VoiceTranscriptionError'
  }
}

const providerResponseSchema = z.object({
  transcript: z.string().max(20_000),
})

export async function transcribeVoice(
  audio: Buffer,
  language: 'en' | 'bn',
): Promise<string> {
  const apiKey = process.env.MODEL_API_KEY?.trim()
  if (!apiKey) {
    throw new VoiceTranscriptionError('MODEL_UNAVAILABLE', 503)
  }

  const boundary = `krishilens-${randomBytes(16).toString('hex')}`
  const configuration = JSON.stringify({
    model: VOICE_MODEL,
    audioEncoding: 'WAV',
    mode: 'PUSH_TO_TALK',
    languageBias: [language === 'bn' ? 'Bengali' : 'English'],
  })
  const audioBytes = new Uint8Array(audio.byteLength)
  audioBytes.set(audio)
  const body = new Blob([
    `--${boundary}\r\nContent-Disposition: form-data; name="request"\r\nContent-Type: application/json\r\n\r\n${configuration}\r\n`,
    `--${boundary}\r\nContent-Disposition: form-data; name="audio"; filename="recording.wav"\r\nContent-Type: audio/wav\r\n\r\n`,
    audioBytes.buffer,
    `\r\n--${boundary}--\r\n`,
  ], { type: `multipart/form-data; boundary=${boundary}` })

  const timeoutSignal = AbortSignal.timeout(30_000)
  let providerResponse: Response
  try {
    providerResponse = await fetch(
      `${(process.env.META_BASE_URL?.trim() || 'https://api.meta.ai/v1').replace(/\/+$/, '')}/asr/transcribe`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: 'application/json',
          'Content-Type': body.type,
        },
        body,
        signal: timeoutSignal,
      },
    )
  } catch (error) {
    if (
      error instanceof Error &&
      (error.name === 'TimeoutError' || error.name === 'AbortError')
    ) {
      throw new VoiceTranscriptionError('MODEL_UNAVAILABLE', 504)
    }
    throw new VoiceTranscriptionError('MODEL_UNAVAILABLE', 502)
  }

  if (!providerResponse.ok) {
    if (providerResponse.status === 429) {
      throw new VoiceTranscriptionError('RATE_LIMITED', 429)
    }
    throw new VoiceTranscriptionError(
      'MODEL_UNAVAILABLE',
      providerResponse.status >= 500 ? 503 : 502,
    )
  }

  let responseBody: unknown
  try {
    responseBody = await providerResponse.json()
  } catch {
    throw new VoiceTranscriptionError(
      'MODEL_UNAVAILABLE',
      timeoutSignal.aborted ? 504 : 502,
    )
  }

  const parsed = providerResponseSchema.safeParse(responseBody)
  if (!parsed.success) {
    throw new VoiceTranscriptionError('MODEL_UNAVAILABLE', 502)
  }

  const transcript = parsed.data.transcript.trim()
  if (!transcript) {
    throw new VoiceTranscriptionError('NO_SPEECH', 422)
  }
  if (transcript.length > 2_000) {
    throw new VoiceTranscriptionError('TRANSCRIPTION_FAILED', 422)
  }

  return transcript
}
