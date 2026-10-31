import { z } from 'zod'
import type { SamAnalysis } from '../services/sam.js'
import type { AgentLanguage, Crop, InvestigationReport } from './types.js'

const evidenceLevelSchema = z.enum([
  'supported',
  'tentative',
  'insufficient_evidence',
])

export const reportDraftSchema = z
  .object({
    caseId: z.string().uuid(),
    cropType: z.enum(['rice', 'wheat', 'maize', 'jute', 'other']),
    language: z.enum(['bn', 'en']),
    summary: z.string().min(1).max(1200),
    possibleCauses: z
      .array(
        z
          .object({
            cause: z.string().min(2).max(240),
            evidenceLevel: evidenceLevelSchema,
            observationIds: z.array(z.string().min(1)).max(8),
            sourceIds: z.array(z.string().min(1)).max(8),
          })
          .strict(),
      )
      .max(6),
    missingInformation: z.array(z.string().min(1).max(300)).max(8),
    safeNextSteps: z.array(z.string().min(1).max(400)).max(8),
    citationIds: z.array(z.string().min(1)).max(8),
    evidenceStatus: evidenceLevelSchema,
    escalationRecommendation: z
      .object({
        recommended: z.boolean(),
        reason: z.string().max(400),
      })
      .strict(),
  })
  .strict()

export type ReportDraft = z.infer<typeof reportDraftSchema>

export interface ReportEvidence {
  observations: Array<{ id: string; description: string }>
  sources: Array<{
    id: string
    title: string
    url: string
    excerpt: string
    tags: string[]
    scope: 'institutional' | 'agronomic'
  }>
  scan: SamAnalysis
  crop: Crop
  language: AgentLanguage
  caseId: string
}

export interface SafetyResult {
  status: 'pass' | 'revise' | 'escalate'
  reasons: string[]
}

function reportText(draft: ReportDraft): string {
  return [
    draft.summary,
    ...draft.possibleCauses.map((cause) => cause.cause),
    ...draft.missingInformation,
    ...draft.safeNextSteps,
    draft.escalationRecommendation.reason,
  ].join(' ')
}

const chemicalInstructionPattern =
  /\b(?:spray|apply|mix|use|treat(?:ment)?)\b.{0,100}\b(?:pesticide|insecticide|fungicide|herbicide|chemical|active ingredient)\b|\b(?:pesticide|insecticide|fungicide|herbicide)\b.{0,100}\b(?:ml|millilit(?:er|re)|gram|g\/l|dose|dosage|spray|apply|mix)\b/i

export function checkReportSafety(
  draft: ReportDraft,
  evidence: ReportEvidence,
): SafetyResult {
  const reasons: string[] = []
  const retrievedSourceIds = new Set(evidence.sources.map((source) => source.id))
  const observationIds = new Set(evidence.observations.map((observation) => observation.id))

  if (
    draft.caseId !== evidence.caseId ||
    draft.cropType !== evidence.crop ||
    draft.language !== evidence.language
  ) {
    reasons.push('The report case, crop, or language does not match the investigation.')
  }

  for (const sourceId of draft.citationIds) {
    if (!retrievedSourceIds.has(sourceId)) {
      reasons.push(`Citation ${sourceId} was not retrieved by this investigation.`)
    }
  }

  for (const cause of draft.possibleCauses) {
    if (
      cause.observationIds.some((id) => !observationIds.has(id)) ||
      cause.sourceIds.some((id) => !retrievedSourceIds.has(id))
    ) {
      reasons.push(`The evidence for "${cause.cause}" refers to unavailable evidence.`)
    }
    if (
      cause.sourceIds.some(
        (id) =>
          evidence.sources.find((source) => source.id === id)?.scope !==
          'agronomic',
      )
    ) {
      reasons.push(
        `A source used to support "${cause.cause}" is not symptom-specific agronomic evidence.`,
      )
    }
    if (
      cause.evidenceLevel === 'supported' &&
      (cause.sourceIds.length === 0 ||
        cause.sourceIds.some((id) => !draft.citationIds.includes(id)))
    ) {
      reasons.push(`The supported claim "${cause.cause}" lacks a retrieved citation.`)
    }
  }

  const citations = new Set(draft.citationIds)
  if (citations.size !== draft.citationIds.length) {
    reasons.push('The report repeats a source citation.')
  }

  const percentValues = reportText(draft).match(/\b\d+(?:\.\d+)?\s*%/g) ?? []
  const measuredPercentage =
    evidence.scan.affectedArea.status === 'accepted'
      ? evidence.scan.affectedArea.percentage
      : null
  if (
    percentValues.some((value) => {
      const parsed = Number.parseFloat(value)
      return measuredPercentage === null || parsed !== measuredPercentage
    })
  ) {
    reasons.push('The report includes a percentage not supported by the validated scan.')
  }

  if (chemicalInstructionPattern.test(reportText(draft))) {
    reasons.push('The report contains an unverified chemical treatment instruction.')
  }

  const scanQuality = evidence.scan.affectedArea.status
  const hasAgronomicEvidence = evidence.sources.some(
    (source) => source.scope === 'agronomic',
  )
  if (!hasAgronomicEvidence && draft.evidenceStatus !== 'insufficient_evidence') {
    reasons.push(
      'No symptom-specific agricultural source was retrieved; evidence status must remain insufficient.',
    )
  }
  if (
    (draft.evidenceStatus === 'insufficient_evidence' ||
      (scanQuality !== 'accepted' && draft.evidenceStatus === 'supported')) &&
    !draft.escalationRecommendation.recommended
  ) {
    return {
      status: 'escalate',
      reasons: [
        ...reasons,
        'Insufficient or uncertain evidence requires referral to a qualified agricultural officer.',
      ],
    }
  }

  return {
    status: reasons.length > 0 ? 'revise' : 'pass',
    reasons,
  }
}

export function createInvestigationReport(
  draft: ReportDraft,
  evidence: ReportEvidence,
  safety: SafetyResult,
): InvestigationReport {
  const sourcesById = new Map(evidence.sources.map((source) => [source.id, source]))
  const observationById = new Map(
    evidence.observations.map((observation) => [observation.id, observation]),
  )

  return {
    caseId: evidence.caseId,
    cropType: evidence.crop,
    language: evidence.language,
    summary: draft.summary,
    visibleObservations: evidence.observations,
    possibleCauses: draft.possibleCauses.map((cause) => ({
      cause: cause.cause,
      evidenceLevel: cause.evidenceLevel,
      supportingEvidence: [
        ...cause.observationIds.flatMap((id) => {
          const observation = observationById.get(id)
          return observation
            ? [{ type: 'observation' as const, referenceId: id, description: observation.description }]
            : []
        }),
        ...cause.sourceIds.flatMap((id) => {
          const source = sourcesById.get(id)
          return source
            ? [{ type: 'source' as const, referenceId: id, description: source.excerpt }]
            : []
        }),
      ],
    })),
    missingInformation: draft.missingInformation,
    safeNextSteps: draft.safeNextSteps,
    citations: draft.citationIds.flatMap((sourceId) => {
      const source = sourcesById.get(sourceId)
      return source ? [{ sourceId, title: source.title, url: source.url }] : []
    }),
    evidenceStatus: draft.evidenceStatus,
    escalationRecommendation:
      safety.status === 'escalate'
        ? {
            recommended: true,
            reason:
              draft.escalationRecommendation.reason ||
              'Available evidence is insufficient; consult a qualified agricultural officer.',
          }
        : draft.escalationRecommendation,
    segmentationMeasurementQuality: {
      status: evidence.scan.affectedArea.status,
      leafPixelCount: evidence.scan.leaf.pixelCount,
      affectedPixelCount: evidence.scan.affectedArea.pixelCount,
      percentage: evidence.scan.affectedArea.percentage,
    },
  }
}
