import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from '../i18n'
import { startInvestigation } from '../services/agent'
import { AgentInvestigation } from './AgentInvestigation'

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

describe('AgentInvestigation', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en')
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
})
