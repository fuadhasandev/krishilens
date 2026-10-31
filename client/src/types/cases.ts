import type { Crop } from './cropAnalysis'
import type { InvestigationReport } from './agent'

export interface CropCase {
  caseId: string
  crop: Crop
  language: 'bn' | 'en'
  status: 'active' | 'completed' | 'needs_follow_up'
  createdAt: string
  updatedAt: string
  lastScanAt: string | null
  nextRecheckAt: string | null
  scanIds: string[]
  isRecheckOverdue?: boolean
}

export interface CaseScan {
  scanId: string
  image: { width: number; height: number }
  samModel: string
  leafDetected: boolean
  leafPixelCount: number | null
  affectedPixelCount: number | null
  affectedPercent: number | null
  measurementQuality: 'accepted' | 'needs_review' | 'unavailable'
  createdAt: string
}

export interface CaseInvestigation {
  investigationId: string
  farmerQuestion: string
  agentStatus: string
  language: 'bn' | 'en'
  report: InvestigationReport | null
  createdAt: string
}

export interface CaseRecheck {
  recheckId: string
  previousScanId: string | null
  currentScanId: string
  intendedDate: string | null
  completedAt: string
  observations: string
  comparison: {
    previousScanId: string
    currentScanId: string
    previousAffectedPercent: number | null
    currentAffectedPercent: number | null
    percentagePointChange: number | null
    comparable: boolean
    assessment: 'possible_improvement' | 'possible_worsening' | 'inconclusive'
    reasons: string[]
  } | null
  assessment: { language: 'bn' | 'en'; text: string; generatedBy: string }
}

export interface CaseDetailsResponse {
  case: CropCase
  scans: CaseScan[]
  investigations: CaseInvestigation[]
  rechecks: CaseRecheck[]
}
