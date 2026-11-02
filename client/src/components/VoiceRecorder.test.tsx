import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from '../i18n'
import { transcribeVoice } from '../services/voice'
import { VoiceRecorder } from './VoiceRecorder'

class TestMediaRecorder {
  static isTypeSupported = vi.fn(() => true)
  static emitAudio = true
  static latestRecorder: TestMediaRecorder | null = null

  state: RecordingState = 'inactive'
  readonly mimeType = 'audio/webm'
  ondataavailable: ((event: BlobEvent) => void) | null = null
  onstop: (() => void) | null = null

  constructor() {
    TestMediaRecorder.latestRecorder = this
  }

  start() {
    this.state = 'recording'
  }

  stop() {
    this.state = 'inactive'
    if (TestMediaRecorder.emitAudio) {
      this.ondataavailable?.({ data: new Blob(['recording']) } as BlobEvent)
    }
    this.onstop?.()
  }
}

vi.mock('../services/voice', () => ({
  transcribeVoice: vi.fn(),
}))

vi.mock('../utils/voiceAudio', () => ({
  convertRecordingToWav: vi.fn(async () => new Blob(['wav'], { type: 'audio/wav' })),
  supportedRecordingMimeType: (recorder: typeof MediaRecorder) =>
    recorder.isTypeSupported('audio/webm') ? 'audio/webm' : null,
}))

describe('VoiceRecorder', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en')
    vi.clearAllMocks()
    vi.stubGlobal('MediaRecorder', TestMediaRecorder)
    TestMediaRecorder.isTypeSupported.mockReturnValue(true)
    TestMediaRecorder.emitAudio = true
    TestMediaRecorder.latestRecorder = null
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn(async () => ({
          getTracks: () => [{ stop: vi.fn() }],
        })),
      },
    })
  })

  it('explains when microphone permission is denied', async () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn(async () => {
          throw new DOMException('Permission denied', 'NotAllowedError')
        }),
      },
    })
    const user = userEvent.setup()
    render(<VoiceRecorder onTranscript={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Record a voice question' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Microphone access was denied',
    )
  })

  it('shows a clear message when no recording format is supported', async () => {
    TestMediaRecorder.isTypeSupported.mockReturnValue(false)
    const user = userEvent.setup()
    render(<VoiceRecorder onTranscript={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Record a voice question' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Voice recording is not supported',
    )
  })

  it('allows retrying a failed transcription of the same recording', async () => {
    vi.mocked(transcribeVoice)
      .mockRejectedValueOnce(new Error('RATE_LIMITED'))
      .mockResolvedValueOnce('Brown spots on leaves')
    const onTranscript = vi.fn()
    const user = userEvent.setup()
    render(<VoiceRecorder onTranscript={onTranscript} />)

    await user.click(screen.getByRole('button', { name: 'Record a voice question' }))
    await user.click(await screen.findByRole('button', { name: 'Stop recording' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The service is busy right now',
    )
    await user.click(screen.getByRole('button', { name: 'Retry transcription' }))

    expect(await screen.findByText(/Brown spots on leaves/)).toBeInTheDocument()
    expect(onTranscript).toHaveBeenCalledWith('Brown spots on leaves')
    expect(transcribeVoice).toHaveBeenCalledTimes(2)
  })

  it('does not send an empty recording for transcription', async () => {
    TestMediaRecorder.emitAudio = false
    const onTranscript = vi.fn()
    const user = userEvent.setup()
    render(<VoiceRecorder onTranscript={onTranscript} />)

    await user.click(screen.getByRole('button', { name: 'Record a voice question' }))
    await user.click(await screen.findByRole('button', { name: 'Stop recording' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The recording was empty',
    )
    expect(transcribeVoice).not.toHaveBeenCalled()
    expect(onTranscript).not.toHaveBeenCalled()
  })

  it('cancels recording without submitting audio', async () => {
    const user = userEvent.setup()
    render(<VoiceRecorder onTranscript={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Record a voice question' }))
    await user.click(await screen.findByRole('button', { name: 'Cancel recording' }))

    expect(TestMediaRecorder.latestRecorder?.state).toBe('inactive')
    expect(transcribeVoice).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Record a voice question' })).toBeInTheDocument()
  })
})
