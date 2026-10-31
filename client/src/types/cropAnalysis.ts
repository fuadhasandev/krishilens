export type Crop = 'rice' | 'wheat' | 'maize' | 'jute' | 'other'
export type ResponseLanguage = 'bn' | 'en'

export interface CropAnalysisRequest {
  crop: Crop
  question: string
  language: ResponseLanguage
}

export interface CropAnalysisResponse {
  success: boolean
  model: string
  answer: string
  requestId?: string
}
