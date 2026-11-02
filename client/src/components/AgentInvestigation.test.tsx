import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from '../i18n'
import { answerInvestigation, startInvestigation } from '../services/agent'
import { transcribeVoice } from '../services/voice'
import { AgentInvestigation } from './AgentInvestigation'

class TestMediaRecorder {
  static isTypeSupported = vi.fn((mimeType: string) =>
    mimeType === 'audio/webm;codecs=opus',
  )

  state: RecordingState = 'inactive'
  readonly mimeType = 'audio/webm;codecs=opus'
  ondataavailable: ((event: BlobEvent) => void) | null = null
  onstop: (() => void) | null = null
  onerror: (() => void) | null = null

  start() {
    this.state = 'recording'
  }

  stop() {
    this.state = 'inactive'
    this.ondataavailable?.({ data: new Blob(['recorded audio']) } as BlobEvent)
    this.onstop?.()
  }
}

vi.mock('../services/agent', () => ({
  answerInvestigation: vi.fn(async () => ({
    success: true,
    sessionId: 'session-1234',
    language: 'en',
    status: 'completed',
    trace: [],
  })),
  startInvestigation: vi.fn(async () => ({
    success: true,
    sessionId: 'session-1234',
    language: 'en',
    status: 'awaiting_farmer',
    accessToken: 'session-access',
    pendingQuestion: {
      question: 'When did you first notice the spots?',
      why: 'The timing may help guide the investigation.',
    },
    trace: [],
  })),
  translateInvestigation: vi.fn(),
}))

vi.mock('../services/voice', () => ({
  transcribeVoice: vi.fn(async () => 'Brown spots on rice leaves'),
}))

vi.mock('../utils/voiceAudio', () => ({
  convertRecordingToWav: vi.fn(async () => new Blob(['wav'], { type: 'audio/wav' })),
  supportedRecordingMimeType: vi.fn(() => 'audio/webm;codecs=opus'),
}))

describe('AgentInvestigation', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en')
    vi.clearAllMocks()
    vi.stubGlobal('MediaRecorder', TestMediaRecorder)
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn(async () => ({
          getTracks: () => [{ stop: vi.fn() }],
        })),
      },
    })
  })

  it('shows the farmer question, real follow-up, and submitted answer', async () => {
    const user = userEvent.setup()
    render(
      <AgentInvestigation
        crop="rice"
        scanAccessToken="scan-access"
        scanId="scan-1234"
      />,
    )

    await user.type(screen.getByRole('textbox', { name: 'Your answer' }), 'Brown spots on several leaves')
    await user.click(screen.getByRole('button', { name: 'Start investigation' }))

    expect(await screen.findByText('Brown spots on several leaves')).toBeInTheDocument()
    expect(screen.getByText('When did you first notice the spots?')).toBeInTheDocument()
    await user.type(screen.getByRole('textbox', { name: 'Your answer' }), 'Two days ago')
    await user.click(screen.getByRole('button', { name: 'Send answer' }))

    expect(await screen.findByText('Two days ago')).toBeInTheDocument()
    expect(screen.getByText('Investigation complete')).toBeInTheDocument()
  })

  it('starts new investigations in the currently selected language', async () => {
    const user = userEvent.setup()
    await i18n.changeLanguage('bn')
    render(
      <AgentInvestigation
        crop="rice"
        scanAccessToken="scan-access"
        scanId="scan-1234"
      />,
    )

    await user.type(screen.getByRole('textbox', { name: 'আপনার উত্তর' }), 'ধানের পাতায় দাগ')
    await user.click(screen.getByRole('button', { name: 'তদন্ত শুরু করুন' }))

    expect(startInvestigation).toHaveBeenCalledWith(expect.objectContaining({ language: 'bn' }))
    expect(await screen.findByText('ধানের পাতায় দাগ')).toBeInTheDocument()
  })

  it('preserves the current investigation and farmer messages when display language changes', async () => {
    const user = userEvent.setup()
    render(
      <AgentInvestigation
        crop="rice"
        scanAccessToken="scan-access"
        scanId="scan-1234"
      />,
    )

    await user.type(screen.getByRole('textbox', { name: 'Your answer' }), 'Brown spots on leaves')
    await user.click(screen.getByRole('button', { name: 'Start investigation' }))
    expect(await screen.findByText('When did you first notice the spots?')).toBeInTheDocument()

    await i18n.changeLanguage('bn')

    expect(await screen.findByRole('heading', { name: 'আপনার পর্যবেক্ষণ খতিয়ে দেখুন' })).toBeInTheDocument()
    expect(screen.getByText('Brown spots on leaves')).toBeInTheDocument()
    expect(screen.getByText('When did you first notice the spots?')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'আপনার উত্তর' })).toBeInTheDocument()
  })

  it('transcribes an English voice question into the existing investigation input', async () => {
    const user = userEvent.setup()
    render(
      <AgentInvestigation
        crop="rice"
        scanAccessToken="scan-access"
        scanId="scan-1234"
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Record a voice question' }))
    await user.click(await screen.findByRole('button', { name: 'Stop recording' }))
    const question = await screen.findByRole('textbox', { name: 'Your answer' })

    expect(question).toHaveValue('Brown spots on rice leaves')
    expect(transcribeVoice).toHaveBeenCalledWith(
      expect.any(Blob),
      'en',
      { scanId: 'scan-1234', accessToken: 'scan-access' },
    )
  })

  it('lets a farmer edit a Bengali transcript before submitting it', async () => {
    const user = userEvent.setup()
    vi.mocked(transcribeVoice).mockResolvedValueOnce('ধানের পাতায় দাগ')
    await i18n.changeLanguage('bn')
    render(
      <AgentInvestigation
        crop="rice"
        scanAccessToken="scan-access"
        scanId="scan-1234"
      />,
    )

    await user.click(screen.getByRole('button', { name: 'কথা রেকর্ড করুন' }))
    await user.click(await screen.findByRole('button', { name: 'রেকর্ড বন্ধ করুন' }))
    const question = await screen.findByRole('textbox', { name: 'আপনার উত্তর' })
    expect(question).toHaveValue('ধানের পাতায় দাগ')
    await user.clear(question)
    await user.type(question, 'ধানের পাতায় বাদামি দাগ')
    await user.click(screen.getByRole('button', { name: 'তদন্ত শুরু করুন' }))

    expect(startInvestigation).toHaveBeenCalledWith(
      expect.objectContaining({
        language: 'bn',
        question: 'ধানের পাতায় বাদামি দাগ',
      }),
    )
    expect(transcribeVoice).toHaveBeenCalledWith(
      expect.any(Blob),
      'bn',
      { scanId: 'scan-1234', accessToken: 'scan-access' },
    )
  })

  it('uses the existing answer flow for a transcribed follow-up', async () => {
    const user = userEvent.setup()
    vi.mocked(transcribeVoice).mockResolvedValueOnce('New brown spots appeared')
    render(
      <AgentInvestigation
        crop="rice"
        scanAccessToken="scan-access"
        scanId="scan-1234"
      />,
    )

    await user.type(
      screen.getByRole('textbox', { name: 'Your answer' }),
      'There are spots on some leaves',
    )
    await user.click(screen.getByRole('button', { name: 'Start investigation' }))
    await screen.findByText('When did you first notice the spots?')
    await user.click(screen.getByRole('button', { name: 'Record a voice question' }))
    await user.click(await screen.findByRole('button', { name: 'Stop recording' }))
    const answer = await screen.findByRole('textbox', { name: 'Your answer' })

    expect(answer).toHaveValue('New brown spots appeared')
    expect(transcribeVoice).toHaveBeenCalledWith(
      expect.any(Blob),
      'en',
      { sessionId: 'session-1234', accessToken: 'session-access' },
    )
    await user.click(screen.getByRole('button', { name: 'Send answer' }))

    expect(answerInvestigation).toHaveBeenCalledWith(
      'session-1234',
      'session-access',
      'New brown spots appeared',
      'en',
    )
  })
})
