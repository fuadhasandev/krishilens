import { describe, expect, it, vi } from 'vitest'
import { encodePcmWav, supportedRecordingMimeType } from './voiceAudio'

function fakeAudioBuffer(
  channels: Float32Array[],
  sampleRate: number,
): AudioBuffer {
  const length = channels[0]?.length ?? 0
  return {
    duration: length / sampleRate,
    length,
    numberOfChannels: channels.length,
    sampleRate,
    getChannelData: (channel) => channels[channel] ?? new Float32Array(),
    copyFromChannel: (destination, channel, startInChannel = 0) => {
      destination.set(channels[channel]?.subarray(startInChannel) ?? [])
    },
    copyToChannel: (source, channel, startInChannel = 0) => {
      channels[channel]?.set(source, startInChannel)
    },
  }
}

describe('voice audio helpers', () => {
  it('encodes mono 16-bit PCM WAV and downmixes stereo at the target rate', async () => {
    const wav = encodePcmWav(
      fakeAudioBuffer(
        [new Float32Array([0.5, 0.5]), new Float32Array([-0.5, -0.5])],
        24_000,
      ),
    )
    const bytes = await wav.arrayBuffer()
    const view = new DataView(bytes)

    expect(wav.type).toBe('audio/wav')
    expect(view.getUint32(24, true)).toBe(24_000)
    expect(view.getUint16(22, true)).toBe(1)
    expect(view.getUint16(34, true)).toBe(16)
    expect(view.getUint32(40, true)).toBe(4)
    expect(view.getInt16(44, true)).toBe(0)
    expect(view.getInt16(46, true)).toBe(0)
  })

  it('resamples mono input and selects a browser-supported recorder format', () => {
    const wav = encodePcmWav(
      fakeAudioBuffer([new Float32Array([0.25, -0.25, 0.5, -0.5])], 48_000),
    )
    expect(wav.size).toBe(48)
    expect(supportedRecordingMimeType({
      isTypeSupported: (mimeType: string) => mimeType === 'audio/mp4',
    } as typeof MediaRecorder)).toBe('audio/mp4')
    expect(supportedRecordingMimeType({
      isTypeSupported: vi.fn(() => false),
    } as typeof MediaRecorder)).toBeNull()
  })
})
