import assert from 'node:assert/strict'
import { createServer, request as httpRequest } from 'node:http'
import { once } from 'node:events'
import test from 'node:test'
import { app } from '../src/app.js'
import {
  AudioValidationError,
  MAX_VOICE_UPLOAD_BYTES,
  validatePcmWav,
} from '../src/services/audioValidation.js'
import {
  transcribeVoice,
  VoiceTranscriptionError,
} from '../src/services/voiceTranscription.js'

function pcmWav(sampleRate = 16_000, durationSeconds = 1): Buffer {
  const dataLength = sampleRate * durationSeconds * 2
  const audio = Buffer.alloc(44 + dataLength)
  audio.write('RIFF', 0)
  audio.writeUInt32LE(audio.length - 8, 4)
  audio.write('WAVE', 8)
  audio.write('fmt ', 12)
  audio.writeUInt32LE(16, 16)
  audio.writeUInt16LE(1, 20)
  audio.writeUInt16LE(1, 22)
  audio.writeUInt32LE(sampleRate, 24)
  audio.writeUInt32LE(sampleRate * 2, 28)
  audio.writeUInt16LE(2, 32)
  audio.writeUInt16LE(16, 34)
  audio.write('data', 36)
  audio.writeUInt32LE(dataLength, 40)
  return audio
}

function multipartBody(
  audio: Buffer,
  fields: Record<string, string> = { language: 'en' },
  mimeType = 'audio/wav',
): { boundary: string; body: Buffer } {
  const boundary = 'voice-test-boundary'
  const parts: Buffer[] = []
  for (const [name, value] of Object.entries(fields)) {
    parts.push(Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`,
    ))
  }
  parts.push(Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="audio"; filename="recording.wav"\r\nContent-Type: ${mimeType}\r\n\r\n`,
  ))
  parts.push(audio)
  parts.push(Buffer.from(`\r\n--${boundary}--\r\n`))
  return { boundary, body: Buffer.concat(parts) }
}

async function postVoice(
  port: number,
  audio: Buffer,
  fields?: Record<string, string>,
  mimeType?: string,
  authorization?: string,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const multipart = multipartBody(audio, fields, mimeType)
  return new Promise((resolve, reject) => {
    const request = httpRequest({
      host: '127.0.0.1',
      port,
      method: 'POST',
      path: '/api/voice/transcribe',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${multipart.boundary}`,
        'Content-Length': multipart.body.length,
        Connection: 'close',
        ...(authorization ? { Authorization: authorization } : {}),
      },
    }, (response) => {
      const chunks: Buffer[] = []
      response.on('data', (chunk: Buffer) => chunks.push(chunk))
      response.on('end', () => {
        try {
          resolve({
            status: response.statusCode ?? 0,
            body: JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>,
          })
        } catch (error) {
          reject(error)
        }
      })
    })
    request.on('error', reject)
    request.end(multipart.body)
  })
}

test('WAV validation accepts supported PCM and rejects malformed or unsupported audio', () => {
  assert.deepEqual(validatePcmWav(pcmWav()), {
    sampleRate: 16_000,
    durationSeconds: 1,
  })
  assert.deepEqual(validatePcmWav(pcmWav(24_000)), {
    sampleRate: 24_000,
    durationSeconds: 1,
  })
  assert.throws(
    () => validatePcmWav(Buffer.from('not a wave file')),
    (error: unknown) =>
      error instanceof AudioValidationError && error.code === 'INVALID_AUDIO',
  )

  const stereo = pcmWav()
  stereo.writeUInt16LE(2, 22)
  assert.throws(
    () => validatePcmWav(stereo),
    (error: unknown) =>
      error instanceof AudioValidationError && error.code === 'INVALID_AUDIO',
  )

  assert.throws(
    () => validatePcmWav(pcmWav(16_000, 60.1)),
    (error: unknown) =>
      error instanceof AudioValidationError && error.code === 'AUDIO_TOO_LONG',
  )
  assert.throws(
    () => validatePcmWav(Buffer.alloc(MAX_VOICE_UPLOAD_BYTES + 1)),
    (error: unknown) =>
      error instanceof AudioValidationError && error.code === 'AUDIO_TOO_LARGE',
  )
})

test('provider request uses the selected language and validates the transcript', async () => {
  const originalKey = process.env.MODEL_API_KEY
  const originalFetch = globalThis.fetch
  process.env.MODEL_API_KEY = 'test-key-not-a-real-credential'
  let observedRequest: Request | undefined
  const sourceAudio = pcmWav()
  sourceAudio.set([0x12, 0x34, 0x56, 0x78], 44)
  globalThis.fetch = async (input, init) => {
    observedRequest = new Request(input, init)
    return new Response(JSON.stringify({ transcript: 'ধানের পাতায় দাগ' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    assert.equal(await transcribeVoice(sourceAudio, 'bn'), 'ধানের পাতায় দাগ')
    assert.ok(observedRequest)
    assert.equal(
      observedRequest.headers.get('authorization'),
      'Bearer test-key-not-a-real-credential',
    )
    assert.equal(observedRequest.url, 'https://api.meta.ai/v1/asr/transcribe')
    const form = await observedRequest.formData()
    const configuration = JSON.parse(form.get('request') as string) as {
      model: string
      audioEncoding: string
      mode: string
      languageBias: string[]
    }
    assert.deepEqual(configuration, {
      model: 'muse-voice-transcribe-1.0',
      audioEncoding: 'WAV',
      mode: 'PUSH_TO_TALK',
      languageBias: ['Bengali'],
    })
    const audioPart = form.get('audio') as File
    assert.equal(audioPart.type, 'audio/wav')
    assert.equal(audioPart.name, 'recording.wav')
    assert.deepEqual(
      Buffer.from(await audioPart.arrayBuffer()),
      sourceAudio,
      'multipart audio bytes exactly match the input WAV buffer',
    )

    globalThis.fetch = async (input, init) => {
      observedRequest = new Request(input, init)
      return new Response(JSON.stringify({ transcript: 'Rice leaf blight' }), {
        status: 200,
      })
    }
    assert.equal(await transcribeVoice(pcmWav(), 'en'), 'Rice leaf blight')
    assert.ok(observedRequest)
    const englishForm = await observedRequest.formData()
    const englishConfiguration = JSON.parse(
      englishForm.get('request') as string,
    ) as { languageBias: string[] }
    assert.deepEqual(englishConfiguration.languageBias, ['English'])
  } finally {
    globalThis.fetch = originalFetch
    if (originalKey === undefined) delete process.env.MODEL_API_KEY
    else process.env.MODEL_API_KEY = originalKey
  }
})

test('provider errors map timeouts, rate limits, and empty speech to client-safe codes', async () => {
  const originalKey = process.env.MODEL_API_KEY
  const originalFetch = globalThis.fetch
  process.env.MODEL_API_KEY = 'test-key-not-a-real-credential'
  try {
    globalThis.fetch = async () => new Response(null, { status: 429 })
    await assert.rejects(
      transcribeVoice(pcmWav(), 'en'),
      (error: unknown) =>
        error instanceof VoiceTranscriptionError &&
        error.code === 'RATE_LIMITED' &&
        error.statusCode === 429,
    )

    globalThis.fetch = async () => {
      throw new DOMException('timeout', 'TimeoutError')
    }
    await assert.rejects(
      transcribeVoice(pcmWav(), 'en'),
      (error: unknown) =>
        error instanceof VoiceTranscriptionError &&
        error.code === 'MODEL_UNAVAILABLE' &&
        error.statusCode === 504,
    )

    globalThis.fetch = async () =>
      new Response(JSON.stringify({ transcript: '  ' }), { status: 200 })
    await assert.rejects(
      transcribeVoice(pcmWav(), 'en'),
      (error: unknown) =>
        error instanceof VoiceTranscriptionError &&
        error.code === 'NO_SPEECH' &&
        error.statusCode === 422,
    )
  } finally {
    globalThis.fetch = originalFetch
    if (originalKey === undefined) delete process.env.MODEL_API_KEY
    else process.env.MODEL_API_KEY = originalKey
  }
})

test('voice endpoint accepts supported WAV, rejects bad formats, and enforces scan access', async () => {
  const originalKey = process.env.MODEL_API_KEY
  const originalFetch = globalThis.fetch
  process.env.MODEL_API_KEY = 'test-key-not-a-real-credential'
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ transcript: 'Brown spots on rice leaves' }), {
      status: 200,
    })
  const server = createServer(app)
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  assert.ok(address && typeof address !== 'string')

  try {
    const port = address.port
    const success = await postVoice(port, pcmWav())
    assert.equal(success.status, 200)
    assert.equal(success.body.transcript, 'Brown spots on rice leaves')

    const wrongMime = await postVoice(port, pcmWav(), undefined, 'audio/webm')
    assert.equal(wrongMime.status, 400)
    assert.equal(wrongMime.body.errorCode, 'INVALID_AUDIO')

    const invalidScope = await postVoice(
      port,
      pcmWav(),
      { language: 'en', scanId: '00000000-0000-4000-8000-000000000001' },
    )
    assert.equal(invalidScope.status, 401)
    assert.equal(invalidScope.body.errorCode, 'UNAUTHORIZED')

    const overDuration = await postVoice(port, pcmWav(16_000, 60.1))
    assert.equal(overDuration.status, 413)
    assert.equal(overDuration.body.errorCode, 'AUDIO_TOO_LONG')

    const tooLarge = await postVoice(
      port,
      Buffer.alloc(MAX_VOICE_UPLOAD_BYTES + 1),
    )
    assert.equal(tooLarge.status, 413)
    assert.equal(tooLarge.body.errorCode, 'AUDIO_TOO_LARGE')

    const rateLimited = await postVoice(port, pcmWav())
    assert.equal(rateLimited.status, 429)
    assert.equal(rateLimited.body.errorCode, 'RATE_LIMITED')
  } finally {
    globalThis.fetch = originalFetch
    if (originalKey === undefined) delete process.env.MODEL_API_KEY
    else process.env.MODEL_API_KEY = originalKey
    server.close()
    await once(server, 'close')
  }
})
