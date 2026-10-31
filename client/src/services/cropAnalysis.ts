import axios from 'axios'
import { apiBaseUrl } from './apiBaseUrl'
import type {
  CropAnalysisRequest,
  CropAnalysisResponse,
} from '../types/cropAnalysis'

const api = axios.create({
  baseURL: apiBaseUrl,
  timeout: 35_000,
})

export async function analyzeCrop(
  request: CropAnalysisRequest,
): Promise<CropAnalysisResponse> {
  try {
    const response = await api.post<CropAnalysisResponse>(
      '/api/ai/analyze',
      request,
    )
    return response.data
  } catch (error) {
    if (axios.isAxiosError<{ errorCode?: string }>(error)) {
      const code = error.response?.data?.errorCode
      if (code) {
        throw new Error(code)
      }

      if (!error.response) {
        throw new Error('NETWORK_ERROR')
      }
    }

    if (error instanceof Error && !axios.isAxiosError(error)) {
      throw error
    }

    throw new Error('ANALYSIS_FAILED')
  }
}
