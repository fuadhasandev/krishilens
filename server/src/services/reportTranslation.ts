import { z } from 'zod'
import type { InvestigationReport, AgentLanguage } from '../agent/types.js'
import { createMetaResponse } from './meta.js'

const translatedTextSchema = z
  .object({
    summary: z.string().max(1200),
    visibleObservations: z.array(
      z.object({ id: z.string(), description: z.string().min(1) }).strict(),
    ).max(8),
    possibleCauses: z.array(
      z.object({
        cause: z.string().min(1),
        supportingEvidence: z.array(
          z.object({
            type: z.enum(['observation', 'source']),
            referenceId: z.string(),
            description: z.string().min(1),
          }).strict(),
        ).max(16),
      }).strict(),
    ).max(6),
    missingInformation: z.array(z.string().min(1)).max(8),
    safeNextSteps: z.array(z.string().min(1)).max(8),
    escalationReason: z.string().max(400),
    pendingQuestion: z.object({
      question: z.string().min(1).max(400),
      why: z.string().min(1).max(300),
    }).strict().optional(),
  })
  .strict()

export type TranslatedInvestigationText = z.infer<typeof translatedTextSchema>

function numericSignature(value: string): string[] {
  return value.match(/[0-9\u09e6-\u09ef]+(?:[.,٫][0-9\u09e6-\u09ef]+)?/g)?.map(
    (number) =>
      number
        .replace(/[০-৯]/g, (digit) => String('০১২৩৪৫৬৭৮৯'.indexOf(digit)))
        .replace(/[٫,]/g, '.'),
  ) ?? []
}

function sameNumbers(source: string, translated: string): boolean {
  return JSON.stringify(numericSignature(source)) ===
    JSON.stringify(numericSignature(translated))
}

function validateTranslation(
  source: InvestigationReport,
  translated: TranslatedInvestigationText,
  targetLanguage: AgentLanguage,
  pendingQuestion?: { question: string; why: string },
): void {
  if (
    translated.visibleObservations.length !== source.visibleObservations.length ||
    translated.possibleCauses.length !== source.possibleCauses.length ||
    translated.missingInformation.length !== source.missingInformation.length ||
    translated.safeNextSteps.length !== source.safeNextSteps.length ||
    translated.visibleObservations.some(
      (item, index) => item.id !== source.visibleObservations[index]?.id,
    ) ||
    translated.possibleCauses.some(
      (item, index) =>
        item.supportingEvidence.length !==
          source.possibleCauses[index]?.supportingEvidence.length ||
        item.supportingEvidence.some(
          (evidence, evidenceIndex) => {
            const original =
              source.possibleCauses[index]?.supportingEvidence[evidenceIndex]
            return evidence.type !== original?.type ||
              evidence.referenceId !== original.referenceId
          },
        ),
    ) ||
    Boolean(pendingQuestion) !== Boolean(translated.pendingQuestion)
  ) {
    throw new Error('The translation changed the investigation structure.')
  }

  const sourceStrings = [
    source.summary,
    ...source.visibleObservations.map((item) => item.description),
    ...source.possibleCauses.flatMap((item) => [
      item.cause,
      ...item.supportingEvidence.map((evidence) => evidence.description),
    ]),
    ...source.missingInformation,
    ...source.safeNextSteps,
    source.escalationRecommendation.reason,
    ...(pendingQuestion ? [pendingQuestion.question, pendingQuestion.why] : []),
  ]
  const translatedStrings = [
    translated.summary,
    ...translated.visibleObservations.map((item) => item.description),
    ...translated.possibleCauses.flatMap((item) => [
      item.cause,
      ...item.supportingEvidence.map((evidence) => evidence.description),
    ]),
    ...translated.missingInformation,
    ...translated.safeNextSteps,
    translated.escalationReason,
    ...(translated.pendingQuestion
      ? [translated.pendingQuestion.question, translated.pendingQuestion.why]
      : []),
  ]
  if (
    sourceStrings.length !== translatedStrings.length ||
    sourceStrings.some((text, index) => {
      const translatedText = translatedStrings[index] ?? ''
      return (text.trim().length === 0) !== (translatedText.trim().length === 0) ||
        !sameNumbers(text, translatedText)
    })
  ) {
    throw new Error('The translation changed a numeric value.')
  }
  if (targetLanguage === source.language) {
    throw new Error('The translation target must differ from the source language.')
  }
}

export async function translateInvestigationText(
  report: InvestigationReport,
  targetLanguage: AgentLanguage,
  pendingQuestion?: { question: string; why: string },
  createResponse: typeof createMetaResponse = createMetaResponse,
): Promise<{
  report: InvestigationReport
  pendingQuestion?: { question: string; why: string }
}> {
  const input = {
    summary: report.summary,
    visibleObservations: report.visibleObservations,
    possibleCauses: report.possibleCauses.map(({ cause, supportingEvidence }) => ({
      cause,
      supportingEvidence,
    })),
    missingInformation: report.missingInformation,
    safeNextSteps: report.safeNextSteps,
    escalationReason: report.escalationRecommendation.reason,
    ...(pendingQuestion ? { pendingQuestion } : {}),
  }
  const targetName = targetLanguage === 'bn' ? 'Bangla (বাংলা)' : 'English'
  const response = await createResponse(
    `Translate the supplied farmer-facing agricultural investigation text into ${targetName}. Preserve every claim's meaning, uncertainty, cautious tone, and all numbers exactly. Do not add, remove, summarize, or infer facts. Keep identifiers and evidence references unchanged. Return only valid JSON matching the supplied shape. Translate text values only. If a number appears, reproduce the exact same numeric value.`,
    JSON.stringify(input),
  )

  let parsed: unknown
  try {
    parsed = JSON.parse(response.answer)
  } catch {
    throw new Error('The translation response was not valid JSON.')
  }
  const translated = translatedTextSchema.parse(parsed)
  validateTranslation(report, translated, targetLanguage, pendingQuestion)

  return {
    report: {
      ...report,
      language: targetLanguage,
      summary: translated.summary,
      visibleObservations: translated.visibleObservations,
      possibleCauses: report.possibleCauses.map((cause, index) => ({
        ...cause,
        cause: translated.possibleCauses[index]?.cause ?? cause.cause,
        supportingEvidence: cause.supportingEvidence.map((evidence, evidenceIndex) => ({
          ...evidence,
          description:
            translated.possibleCauses[index]?.supportingEvidence[evidenceIndex]
              ?.description ?? evidence.description,
        })),
      })),
      missingInformation: translated.missingInformation,
      safeNextSteps: translated.safeNextSteps,
      escalationRecommendation: {
        ...report.escalationRecommendation,
        reason: translated.escalationReason,
      },
    },
    ...(translated.pendingQuestion
      ? { pendingQuestion: translated.pendingQuestion }
      : {}),
  }
}
