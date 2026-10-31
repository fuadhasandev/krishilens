import mongoose, { Schema, model, type Model } from 'mongoose'
import type { AgentSession } from '../agent/types.js'
import type { SamAnalysis } from '../services/sam.js'

interface CaseRecord {
  caseId: string
  ownerId: string
  crop: 'rice' | 'wheat' | 'maize' | 'jute' | 'other'
  language: 'bn' | 'en'
  status: 'active' | 'completed' | 'needs_follow_up'
  lastScanAt: Date | null
  nextRecheckAt: Date | null
  scanIds: string[]
  latestReportId: string | null
  createdAt: Date
  updatedAt: Date
}

interface ScanRecord {
  scanId: string
  caseId: string
  ownerId: string
  imageRef: string
  image: { width: number; height: number }
  samModel: string
  leafDetected: boolean
  leafPixelCount: number | null
  affectedPixelCount: number | null
  affectedPercent: number | null
  measurementQuality: 'accepted' | 'needs_review' | 'unavailable'
  imageQuality: {
    similarLighting: boolean | null
    similarAngle: boolean | null
    samePlantRegion: boolean | null
  }
  createdAt: Date
}

interface InvestigationRecord {
  investigationId: string
  caseId: string
  ownerId: string
  farmerQuestion: string
  followUps: Array<{ question: string; answer: string; askedAt: Date; answeredAt: Date }>
  agentStatus: string
  report: unknown
  evidenceSourceIds: string[]
  language: 'bn' | 'en'
  state: AgentSession | null
  accessTokenHash: string
  expiresAt: Date
  revision: number
  createdAt: Date
  updatedAt: Date
}

interface AgentScanRecord {
  scanId: string
  accessTokenHash: string
  crop: 'rice' | 'wheat' | 'maize' | 'jute' | 'other'
  target: string
  analysis: SamAnalysis
  createdAt: Date
  expiresAt: Date
}

interface TraceRecord {
  investigationId: string
  caseId: string
  step: number
  toolName: string
  argumentsSummary: string
  result: string
  durationMs: number
  timestamp: Date
}

interface RecheckRecord {
  recheckId: string
  submissionId: string
  caseId: string
  ownerId: string
  previousScanId: string | null
  currentScanId: string
  intendedDate: Date | null
  completedAt: Date
  observations: string
  comparison: unknown
  assessment: {
    language: 'bn' | 'en'
    text: string
    generatedBy: 'muse-spark-1.3' | 'fallback'
  }
  status: 'completed'
  createdAt: Date
  updatedAt: Date
}

interface AnonymousOwnerRecord {
  ownerId: string
  tokenHash: string
  expiresAt: Date
  createdAt: Date
  updatedAt: Date
}

const qualitySchema = new Schema(
  {
    similarLighting: { type: Boolean, default: null },
    similarAngle: { type: Boolean, default: null },
    samePlantRegion: { type: Boolean, default: null },
  },
  { _id: false },
)

const caseSchema = new Schema<CaseRecord>(
  {
    caseId: { type: String, required: true, unique: true, index: true },
    ownerId: { type: String, required: true, index: true },
    crop: { type: String, enum: ['rice', 'wheat', 'maize', 'jute', 'other'], required: true },
    language: { type: String, enum: ['bn', 'en'], required: true },
    status: { type: String, enum: ['active', 'completed', 'needs_follow_up'], default: 'active' },
    lastScanAt: { type: Date, default: null },
    nextRecheckAt: { type: Date, default: null },
    scanIds: { type: [String], default: [] },
    latestReportId: { type: String, default: null },
  },
  { timestamps: true },
)
caseSchema.index({ ownerId: 1, updatedAt: -1 })
caseSchema.index({ ownerId: 1, nextRecheckAt: 1 })

const scanSchema = new Schema<ScanRecord>(
  {
    scanId: { type: String, required: true, unique: true, index: true },
    caseId: { type: String, required: true, index: true },
    ownerId: { type: String, required: true, index: true },
    imageRef: { type: String, required: true },
    image: {
      width: { type: Number, required: true },
      height: { type: Number, required: true },
    },
    samModel: { type: String, required: true },
    leafDetected: { type: Boolean, required: true },
    leafPixelCount: { type: Number, default: null },
    affectedPixelCount: { type: Number, default: null },
    affectedPercent: { type: Number, default: null },
    measurementQuality: {
      type: String,
      enum: ['accepted', 'needs_review', 'unavailable'],
      required: true,
    },
    imageQuality: { type: qualitySchema, default: () => ({}) },
    createdAt: { type: Date, default: Date.now, index: true },
  },
  { versionKey: false },
)
scanSchema.index({ ownerId: 1, caseId: 1, createdAt: -1 })

const investigationSchema = new Schema<InvestigationRecord>(
  {
    investigationId: { type: String, required: true, unique: true, index: true },
    caseId: { type: String, required: true, index: true },
    ownerId: { type: String, required: true, index: true },
    farmerQuestion: { type: String, required: true, maxlength: 2000 },
    followUps: {
      type: [{ question: String, answer: String, askedAt: Date, answeredAt: Date }],
      default: [],
    },
    agentStatus: { type: String, required: true },
    report: { type: Schema.Types.Mixed, default: null },
    evidenceSourceIds: { type: [String], default: [] },
    language: { type: String, enum: ['bn', 'en'], required: true },
    state: { type: Schema.Types.Mixed, default: null },
    accessTokenHash: { type: String, select: false, default: undefined },
    expiresAt: { type: Date, default: null },
    revision: { type: Number, default: 0 },
  },
  { timestamps: true },
)
investigationSchema.index({ ownerId: 1, caseId: 1, createdAt: -1 })
investigationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

const agentScanSchema = new Schema<AgentScanRecord>(
  {
    scanId: { type: String, required: true, unique: true, index: true },
    accessTokenHash: { type: String, required: true, select: false },
    crop: { type: String, enum: ['rice', 'wheat', 'maize', 'jute', 'other'], required: true },
    target: { type: String, required: true },
    analysis: { type: Schema.Types.Mixed, required: true },
    createdAt: { type: Date, default: Date.now, index: true },
    expiresAt: { type: Date, required: true },
  },
  { versionKey: false },
)
agentScanSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

const traceSchema = new Schema<TraceRecord>(
  {
    investigationId: { type: String, required: true, index: true },
    caseId: { type: String, required: true, index: true },
    step: { type: Number, required: true },
    toolName: { type: String, required: true },
    argumentsSummary: { type: String, maxlength: 240, default: '' },
    result: { type: String, maxlength: 500, default: '' },
    durationMs: { type: Number, required: true },
    timestamp: { type: Date, default: Date.now, index: true },
  },
  { versionKey: false },
)
traceSchema.index({ investigationId: 1, step: 1 }, { unique: true })

const recheckSchema = new Schema<RecheckRecord>(
  {
    recheckId: { type: String, required: true, unique: true, index: true },
    submissionId: { type: String, required: true, unique: true },
    caseId: { type: String, required: true, index: true },
    ownerId: { type: String, required: true, index: true },
    previousScanId: { type: String, default: null },
    currentScanId: { type: String, required: true },
    intendedDate: { type: Date, default: null },
    completedAt: { type: Date, default: Date.now },
    observations: { type: String, maxlength: 2000, default: '' },
    comparison: { type: Schema.Types.Mixed, default: null },
    assessment: {
      language: { type: String, enum: ['bn', 'en'], required: true },
      text: { type: String, required: true, maxlength: 2000 },
      generatedBy: { type: String, enum: ['muse-spark-1.3', 'fallback'], required: true },
    },
    status: { type: String, enum: ['completed'], default: 'completed' },
  },
  { timestamps: true },
)
recheckSchema.index({ ownerId: 1, caseId: 1, completedAt: -1 })

const ownerSchema = new Schema<AnonymousOwnerRecord>(
  {
    ownerId: { type: String, required: true, unique: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
)
ownerSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

export const CaseModel: Model<CaseRecord> =
  (mongoose.models.Case as Model<CaseRecord> | undefined) ?? model<CaseRecord>('Case', caseSchema)
export const ScanModel: Model<ScanRecord> =
  (mongoose.models.Scan as Model<ScanRecord> | undefined) ?? model<ScanRecord>('Scan', scanSchema)
export const InvestigationModel =
  (mongoose.models.Investigation as Model<InvestigationRecord> | undefined) ??
  model<InvestigationRecord>('Investigation', investigationSchema)
export const AgentScanModel: Model<AgentScanRecord> =
  (mongoose.models.AgentScan as Model<AgentScanRecord> | undefined) ??
  model<AgentScanRecord>('AgentScan', agentScanSchema)
export const TraceModel: Model<TraceRecord> =
  (mongoose.models.Trace as Model<TraceRecord> | undefined) ?? model<TraceRecord>('Trace', traceSchema)
export const RecheckModel: Model<RecheckRecord> =
  (mongoose.models.Recheck as Model<RecheckRecord> | undefined) ?? model<RecheckRecord>('Recheck', recheckSchema)
export const AnonymousOwnerModel =
  (mongoose.models.AnonymousOwner as Model<AnonymousOwnerRecord> | undefined) ??
  model<AnonymousOwnerRecord>('AnonymousOwner', ownerSchema)
