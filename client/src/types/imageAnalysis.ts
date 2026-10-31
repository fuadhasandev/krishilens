import type { Crop } from './cropAnalysis'

export type SegmentationTarget =
  | 'brown spots'
  | 'yellow discolored region'
  | 'damaged leaf region'

export interface ImageAnalysisResponse {
  success: boolean
  model: 'sam-3.1'
  image: { width: number; height: number }
  leaf: { detected: boolean; pixelCount: number | null }
  affectedArea: {
    pixelCount: number | null
    percentage: number | null
    status: 'accepted' | 'needs_review' | 'unavailable'
  }
  objects: Array<{
    id: string
    label: string
    boundingBox: number[]
    confidence?: number
  }>
  overlay: { imageUrl: string | null }
  requestIds: string[]
  scanId: string
  scanAccessToken: string
  warning?: string
  responseTruncated?: boolean
}

export interface ImageAnalysisRequest {
  image: File
  crop: Crop
  target: SegmentationTarget
  language: 'bn' | 'en'
}
