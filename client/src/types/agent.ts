import type { Crop } from './cropAnalysis'

export type InvestigationLanguage = 'bn' | 'en'
export type InvestigationStatus =
  | 'investigating'
  | 'awaiting_farmer'
  | 'completed'
  | 'escalated'
  | 'failed'

export interface AgentTraceEntry {
  step: number
  timestamp: string
  toolName: string
  summary: string
  status: 'success' | 'failure' | 'blocked'
  durationMs: number
  evidenceReferenceIds: string[]
  error?: string
}

export interface InvestigationReport {
  caseId: string
  cropType: Crop
  language: InvestigationLanguage
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

export interface AgentSessionResponse {
  success: boolean
  sessionId: string
  language: InvestigationLanguage
  status: InvestigationStatus
  accessToken?: string
  pendingQuestion?: { question: string; why: string }
  report?: InvestigationReport
  message?: string
  trace: AgentTraceEntry[]
}

export interface StartInvestigationRequest {
  scanId: string
  scanAccessToken: string
  crop: Crop
  language: InvestigationLanguage
  question: string
}

export interface TranslatedInvestigationText {
  report?: InvestigationReport
  pendingQuestion?: { question: string; why: string }
}
