import type OpenAI from 'openai'
import { z } from 'zod'
import type { SamAnalysis } from '../services/sam.js'

export const cropSchema = z.enum(['rice', 'wheat', 'maize', 'jute', 'other'])
export const languageSchema = z.enum(['bn', 'en'])
export const agentStatusSchema = z.enum([
  'investigating',
  'awaiting_farmer',
  'completed',
  'escalated',
  'failed',
])

export const traceEntrySchema = z.object({
  step: z.number().int().positive(),
  timestamp: z.string().datetime(),
  toolName: z.string().min(1),
  summary: z.string().min(1).max(240),
  status: z.enum(['success', 'failure', 'blocked']),
  durationMs: z.number().int().nonnegative(),
  evidenceReferenceIds: z.array(z.string()).max(12),
  error: z.string().max(200).optional(),
})

export type Crop = z.infer<typeof cropSchema>
export type AgentLanguage = z.infer<typeof languageSchema>
export type AgentStatus = z.infer<typeof agentStatusSchema>
export type TraceEntry = z.infer<typeof traceEntrySchema>

export interface StoredScan {
  id: string
  accessTokenHash: string
  crop: Crop
  target: string
  analysis: SamAnalysis
  createdAt: number
  expiresAt: number
}

export type PendingFunctionOutput = OpenAI.Responses.ResponseInputItem

export interface AgentSession {
  id: string
  accessTokenHash: string
  scanId: string
  crop: Crop
  language: AgentLanguage
  farmerQuestion: string
  status: AgentStatus
  createdAt: number
  updatedAt: number
  expiresAt: number
  modelTurns: number
  answerCount: number
  previousResponseId?: string
  pendingFunctionOutputs: PendingFunctionOutput[]
  pendingQuestion?: { question: string; why: string; callId: string }
  report?: InvestigationReport
  trace: TraceEntry[]
  retrievedSourceIds: string[]
  toolCallFingerprints: string[]
  failureMessage?: string
}

export interface InvestigationReport {
  caseId: string
  cropType: Crop
  language: AgentLanguage
  summary: string
  visibleObservations: Array<{ id: string; description: string }>
  possibleCauses: Array<{
    cause: string
    evidenceLevel: 'supported' | 'tentative' | 'insufficient_evidence'
    supportingEvidence: Array<{
      type: 'observation' | 'source'
      referenceId: string
      description: string
    }>
  }>
  missingInformation: string[]
  safeNextSteps: string[]
  citations: Array<{ sourceId: string; title: string; url: string }>
  evidenceStatus: 'supported' | 'tentative' | 'insufficient_evidence'
  escalationRecommendation: { recommended: boolean; reason: string }
  segmentationMeasurementQuality: {
    status: 'accepted' | 'needs_review' | 'unavailable'
    leafPixelCount: number | null
    affectedPixelCount: number | null
    percentage: number | null
  }
}
