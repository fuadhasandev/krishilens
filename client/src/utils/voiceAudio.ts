const recordingMimeTypes = [
  'audio/webm;codecs=opus',
  'audio/mp4;codecs=mp4a.40.2',
  'audio/ogg;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/ogg',
]
export const MAX_VOICE_DURATION_SECONDS = 60

export function supportedRecordingMimeType(
  mediaRecorder: Pick<typeof MediaRecorder, 'isTypeSupported'>,
): string | null {
  if (typeof mediaRecorder.isTypeSupported !== 'function') {
    return null
  }
  return recordingMimeTypes.find((mimeType) =>
    mediaRecorder.isTypeSupported(mimeType),
  ) ?? null
}

export function encodePcmWav(
  audio: AudioBuffer,
  targetSampleRate = 24_000,
): Blob {
  if (
    audio.numberOfChannels < 1 ||
    audio.length < 1 ||
    !Number.isFinite(audio.sampleRate) ||
    audio.sampleRate < 1 ||
    !Number.isInteger(targetSampleRate) ||
    targetSampleRate < 1
  ) {
    throw new Error('INVALID_AUDIO')
  }

  const sampleCount = Math.ceil(audio.length * targetSampleRate / audio.sampleRate)
  const buffer = new ArrayBuffer(44 + sampleCount * 2)
  const view = new DataView(buffer)
  const writeText = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset + index, value.charCodeAt(index))
    }
  }

  writeText(0, 'RIFF')
  view.setUint32(4, buffer.byteLength - 8, true)
  writeText(8, 'WAVE')
  writeText(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, targetSampleRate, true)
  view.setUint32(28, targetSampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeText(36, 'data')
  view.setUint32(40, sampleCount * 2, true)

  const channels = Array.from({ length: audio.numberOfChannels }, (_, index) =>
    audio.getChannelData(index),
  )
  for (let index = 0; index < sampleCount; index += 1) {
    const sourcePosition = index * audio.sampleRate / targetSampleRate
    const sourceIndex = Math.floor(sourcePosition)
    const fraction = sourcePosition - sourceIndex
    let sample = 0

    for (const channel of channels) {
      const current = channel[Math.min(sourceIndex, audio.length - 1)] ?? 0
      const next = channel[Math.min(sourceIndex + 1, audio.length - 1)] ?? current
      sample += current + (next - current) * fraction
    }
    sample /= channels.length
    const clipped = Math.max(-1, Math.min(1, sample))
    view.setInt16(
      44 + index * 2,
      clipped < 0 ? clipped * 0x8000 : clipped * 0x7fff,
      true,
    )
  }

  return new Blob([buffer], { type: 'audio/wav' })
}

export async function convertRecordingToWav(recording: Blob): Promise<Blob> {
  if (recording.size === 0) {
    throw new Error('EMPTY_AUDIO')
  }
  if (typeof window.AudioContext !== 'function') {
    throw new Error('UNSUPPORTED_AUDIO_FORMAT')
  }

  const context = new window.AudioContext()
  try {
    const audio = await context.decodeAudioData(await recording.arrayBuffer())
    if (audio.duration > MAX_VOICE_DURATION_SECONDS) {
      throw new Error('AUDIO_TOO_LONG')
    }
    return encodePcmWav(audio)
  } catch (error) {
    if (error instanceof Error && error.message === 'AUDIO_TOO_LONG') {
      throw error
    }
    throw new Error('UNSUPPORTED_AUDIO_FORMAT')
  } finally {
    await context.close()
  }
}
