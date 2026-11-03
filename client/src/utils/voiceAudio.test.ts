import { describe, expect, it, vi } from 'vitest'
import { encodePcmWav, supportedRecordingMimeType } from './voiceAudio'

function fakeAudioBuffer(
  channels: Float32Array<ArrayBuffer>[],
  sampleRate: number,
): AudioBuffer {
  const length = channels[0]?.length ?? 0
  return {
    duration: length / sampleRate,
    length,
    numberOfChannels: channels.length,
    sampleRate,
    getChannelData: (channel) =>
      channels[channel] ?? new Float32Array(new ArrayBuffer(0)),
    copyFromChannel: (destination, channel, startInChannel = 0) => {
      destination.set(channels[channel]?.subarray(startInChannel) ?? [])
    },
    copyToChannel: (source, channel, startInChannel = 0) => {
      channels[channel]?.set(source, startInChannel)
    },
  }
}

function float32Array(values: number[]): Float32Array<ArrayBuffer> {
  const samples = new Float32Array(new ArrayBuffer(
    values.length * Float32Array.BYTES_PER_ELEMENT,
  ))
  samples.set(values)
  return samples
}

describe('voice audio helpers', () => {
  it('encodes mono audio as 16-bit PCM WAV without changing its samples', async () => {
    const wav = encodePcmWav(
      fakeAudioBuffer([float32Array([0.25, -0.25, 0.5, -0.5])], 24_000),
    )
    const bytes = await wav.arrayBuffer()
    const view = new DataView(bytes)

    expect(wav.type).toBe('audio/wav')
    expect(view.getUint32(0, false)).toBe(0x52494646)
    expect(view.getUint32(8, false)).toBe(0x57415645)
    expect(view.getUint32(4, true)).toBe(bytes.byteLength - 8)
    expect(view.getUint32(24, true)).toBe(24_000)
    expect(view.getUint16(22, true)).toBe(1)
    expect(view.getUint16(34, true)).toBe(16)
    expect(view.getUint32(40, true)).toBe(8)
    expect([
      view.getInt16(44, true),
      view.getInt16(46, true),
      view.getInt16(48, true),
      view.getInt16(50, true),
    ]).toEqual([8191, -8192, 16383, -16384])
  })

  it('downmixes stereo input and resamples at the target rate', async () => {
    const wav = encodePcmWav(
      fakeAudioBuffer([
        float32Array([0.5, 0, -0.5, 0]),
        float32Array([-0.25, 0, 0.25, 0]),
      ], 48_000),
    )
    const view = new DataView(await wav.arrayBuffer())

    expect(wav.size).toBe(48)
    expect(view.getInt16(44, true)).toBe(4095)
    expect(view.getInt16(46, true)).toBe(-4096)
  })

  it('selects the first browser-supported recording format', () => {
    const isTypeSupported = vi.fn(
      (mimeType: string) => mimeType === 'audio/mp4',
    )

    expect(supportedRecordingMimeType({ isTypeSupported })).toBe('audio/mp4')
    expect(isTypeSupported).toHaveBeenCalledWith('audio/webm;codecs=opus')
    expect(isTypeSupported).toHaveBeenLastCalledWith('audio/mp4')
  })

  it('returns null when the browser supports none of the recording formats', () => {
    const isTypeSupported = vi.fn<typeof MediaRecorder.isTypeSupported>(
      () => false,
    )

    expect(supportedRecordingMimeType({ isTypeSupported })).toBeNull()
  })
})
