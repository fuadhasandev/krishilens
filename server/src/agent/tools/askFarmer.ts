import { z } from 'zod'
import type { AgentSession } from '../types.js'

export const askFarmerInputSchema = z
  .object({
    question: z.string().trim().min(5).max(400),
    why: z.string().trim().min(3).max(300),
  })
  .strict()

export const askFarmerOutputSchema = z
  .object({
    status: z.literal('awaiting_farmer'),
    question: z.string(),
    why: z.string(),
  })
  .strict()

export function askFarmer(
  input: z.infer<typeof askFarmerInputSchema>,
  session: AgentSession,
  callId: string,
): z.infer<typeof askFarmerOutputSchema> {
  if (session.pendingQuestion) {
    throw new Error('A follow-up question is already awaiting an answer.')
  }

  session.status = 'awaiting_farmer'
  session.pendingQuestion = {
    question: input.question,
    why: input.why,
    callId,
  }

  return {
    status: 'awaiting_farmer',
    question: input.question,
    why: input.why,
  }
}
