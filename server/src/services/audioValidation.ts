export const MAX_VOICE_UPLOAD_BYTES = 4 * 1024 * 1024
export const MAX_VOICE_DURATION_SECONDS = 60

export class AudioValidationError extends Error {
  constructor(
    readonly code: 'INVALID_AUDIO' | 'AUDIO_TOO_LONG' | 'AUDIO_TOO_LARGE',
  ) {
    super(code)
    this.name = 'AudioValidationError'
  }
}

export interface PcmWavInfo {
  sampleRate: 16_000 | 24_000
  durationSeconds: number
}

export function validatePcmWav(buffer: Buffer): PcmWavInfo {
  if (buffer.length > MAX_VOICE_UPLOAD_BYTES) {
    throw new AudioValidationError('AUDIO_TOO_LARGE')
  }
  if (
    buffer.length < 44 ||
    buffer.toString('ascii', 0, 4) !== 'RIFF' ||
    buffer.toString('ascii', 8, 12) !== 'WAVE' ||
    buffer.readUInt32LE(4) !== buffer.length - 8
  ) {
    throw new AudioValidationError('INVALID_AUDIO')
  }

  let format: {
    encoding: number
    channels: number
    sampleRate: number
    byteRate: number
    blockAlign: number
    bitsPerSample: number
  } | undefined
  let dataSize: number | undefined
  let offset = 12

  while (offset + 8 <= buffer.length) {
    const chunkId = buffer.toString('ascii', offset, offset + 4)
    const chunkSize = buffer.readUInt32LE(offset + 4)
    const chunkStart = offset + 8
    const chunkEnd = chunkStart + chunkSize
    if (chunkEnd > buffer.length) {
      throw new AudioValidationError('INVALID_AUDIO')
    }

    if (chunkId === 'fmt ') {
      if (format || chunkSize < 16) {
        throw new AudioValidationError('INVALID_AUDIO')
      }
      format = {
        encoding: buffer.readUInt16LE(chunkStart),
        channels: buffer.readUInt16LE(chunkStart + 2),
        sampleRate: buffer.readUInt32LE(chunkStart + 4),
        byteRate: buffer.readUInt32LE(chunkStart + 8),
        blockAlign: buffer.readUInt16LE(chunkStart + 12),
        bitsPerSample: buffer.readUInt16LE(chunkStart + 14),
      }
    } else if (chunkId === 'data') {
      if (dataSize !== undefined) {
        throw new AudioValidationError('INVALID_AUDIO')
      }
      dataSize = chunkSize
    }

    offset = chunkEnd + (chunkSize % 2)
  }

  if (offset !== buffer.length || !format || dataSize === undefined || dataSize === 0) {
    throw new AudioValidationError('INVALID_AUDIO')
  }

  const { encoding, channels, sampleRate, byteRate, blockAlign, bitsPerSample } = format
  if (
    encoding !== 1 ||
    channels !== 1 ||
    (sampleRate !== 16_000 && sampleRate !== 24_000) ||
    bitsPerSample !== 16 ||
    blockAlign !== 2 ||
    byteRate !== sampleRate * blockAlign ||
    dataSize % blockAlign !== 0
  ) {
    throw new AudioValidationError('INVALID_AUDIO')
  }

  const durationSeconds = dataSize / byteRate
  if (durationSeconds > MAX_VOICE_DURATION_SECONDS) {
    throw new AudioValidationError('AUDIO_TOO_LONG')
  }

  return { sampleRate, durationSeconds }
}
