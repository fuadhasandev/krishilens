import { beforeEach, describe, expect, it, vi } from 'vitest'

const { post } = vi.hoisted(() => ({ post: vi.fn() }))

vi.mock('axios', () => ({
  default: {
    create: () => ({ post, get: vi.fn() }),
    isAxiosError: () => false,
  },
}))

import { answerInvestigation, startInvestigation } from './agent'

describe('agent API language contract', () => {
  beforeEach(() => {
    post.mockReset()
    post.mockResolvedValue({ data: { success: true } })
  })

  it('sends the selected language when starting an investigation', async () => {
    await startInvestigation({
      scanId: '4c4a0d82-e14c-40ea-8053-723c3377d8c6',
      scanAccessToken: 'scan-token',
      crop: 'rice',
      language: 'en',
      question: 'Brown spots on leaves',
    })
    expect(post.mock.calls[0]?.[1]).toMatchObject({ language: 'en' })
  })

  it('keeps the original session language on a follow-up answer', async () => {
    await answerInvestigation(
      '4c4a0d82-e14c-40ea-8053-723c3377d8c6',
      'session-token',
      'The spots started five days ago.',
      'bn',
    )
    expect(post.mock.calls[0]?.[1]).toEqual({
      answer: 'The spots started five days ago.',
      language: 'bn',
    })
  })
})
