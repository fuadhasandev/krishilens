import { z } from 'zod'
import {
  checkReportSafety,
  reportDraftSchema,
  type ReportEvidence,
} from '../reportValidator.js'

export const checkSafetyInputSchema = z
  .object({ report: reportDraftSchema })
  .strict()

export const checkSafetyOutputSchema = z
  .object({
    status: z.enum(['pass', 'revise', 'escalate']),
    reasons: z.array(z.string()),
  })
  .strict()

export function checkSafety(
  input: z.infer<typeof checkSafetyInputSchema>,
  evidence: ReportEvidence,
): z.infer<typeof checkSafetyOutputSchema> {
  return checkSafetyOutputSchema.parse(
    checkReportSafety(input.report, evidence),
  )
}
