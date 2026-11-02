import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from '../i18n'
import { analyzeCrop } from '../services/cropAnalysis'
import { CropInvestigationForm } from './CropInvestigationForm'

vi.mock('../services/cropAnalysis', () => ({
  analyzeCrop: vi.fn(async () => ({
    success: true,
    answer: 'Review the affected leaves.',
    model: 'muse-spark-1.3',
    requestId: 'request-1',
  })),
}))

vi.mock('./VoiceRecorder', () => ({
  VoiceRecorder: ({
    onTranscript,
  }: {
    onTranscript: (transcript: string) => void
  }) => (
    <button
      onClick={() => onTranscript('Brown spots on rice leaves')}
      type="button"
    >
      Mock recognized speech
    </button>
  ),
}))

describe('CropInvestigationForm voice input', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en')
    vi.clearAllMocks()
  })

  it('lets the farmer review a transcript and submit it through the existing analysis form', async () => {
    const user = userEvent.setup()
    render(<CropInvestigationForm />)

    await user.click(screen.getByRole('button', { name: 'Mock recognized speech' }))
    const question = screen.getByRole('textbox', { name: 'What have you observed?' })
    expect(question).toHaveValue('Brown spots on rice leaves')
    expect(analyzeCrop).not.toHaveBeenCalled()

    await user.clear(question)
    await user.type(question, 'Leaf blight and brown spots')
    await user.click(screen.getByRole('button', { name: 'Analyze question' }))

    expect(analyzeCrop).toHaveBeenCalledWith({
      crop: 'rice',
      question: 'Leaf blight and brown spots',
      language: 'en',
    })
    expect(await screen.findByText('Review the affected leaves.')).toBeInTheDocument()
  })
})
