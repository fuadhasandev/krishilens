import { z } from 'zod'
import {
  checkReportSafety,
  createInvestigationReport,
  reportDraftSchema,
  type ReportEvidence,
} from '../reportValidator.js'
import type { InvestigationReport } from '../types.js'

const reportSchema = z
  .object({
    caseId: z.string().uuid(),
    cropType: z.enum(['rice', 'wheat', 'maize', 'jute', 'other']),
    language: z.enum(['bn', 'en']),
    summary: z.string(),
    visibleObservations: z.array(z.object({ id: z.string(), description: z.string() })),
    possibleCauses: z.array(
      z.object({
        cause: z.string(),
        evidenceLevel: z.enum(['supported', 'tentative', 'insufficient_evidence']),
        supportingEvidence: z.array(
          z.object({
            type: z.enum(['observation', 'source']),
            referenceId: z.string(),
            description: z.string(),
          }),
        ),
      }),
    ),
    missingInformation: z.array(z.string()),
    safeNextSteps: z.array(z.string()),
    citations: z.array(
      z.object({ sourceId: z.string(), title: z.string(), url: z.string().url() }),
    ),
    evidenceStatus: z.enum(['supported', 'tentative', 'insufficient_evidence']),
    escalationRecommendation: z.object({
      recommended: z.boolean(),
      reason: z.string(),
    }),
    segmentationMeasurementQuality: z.object({
      status: z.enum(['accepted', 'needs_review', 'unavailable']),
      leafPixelCount: z.number().int().nonnegative().nullable(),
      affectedPixelCount: z.number().int().nonnegative().nullable(),
      percentage: z.number().min(0).max(100).nullable(),
    }),
  })
  .strict()

export const finalizeReportInputSchema = z
  .object({ report: reportDraftSchema })
  .strict()

export const finalizeReportOutputSchema = z
  .object({
    status: z.enum(['revise', 'completed', 'escalated']),
    reasons: z.array(z.string()),
    report: reportSchema.nullable(),
  })
  .strict()

export function finalizeReport(
  input: z.infer<typeof finalizeReportInputSchema>,
  evidence: ReportEvidence,
): {
  status: 'revise' | 'completed' | 'escalated'
  reasons: string[]
  report: InvestigationReport | null
} {
  const safety = checkReportSafety(input.report, evidence)
  if (safety.status === 'revise') {
    return { status: 'revise', reasons: safety.reasons, report: null }
  }

  const report = createInvestigationReport(input.report, evidence, safety)
  return {
    status:
      safety.status === 'escalate' ||
      input.report.escalationRecommendation.recommended
        ? 'escalated'
        : 'completed',
    reasons: safety.reasons,
    report,
  }
}
