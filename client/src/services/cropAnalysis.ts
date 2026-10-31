import axios from 'axios'
import type {
  CropAnalysisRequest,
  CropAnalysisResponse,
} from '../types/cropAnalysis'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3000',
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
    if (axios.isAxiosError<CropAnalysisResponse>(error)) {
      const message = error.response?.data?.answer
      if (message) {
        throw new Error(message)
      }

      if (!error.response) {
        throw new Error(
          'Could not connect to KrishiLens. Check that the backend is running and try again.',
        )
      }
    }

    if (error instanceof Error && !axios.isAxiosError(error)) {
      throw error
    }

    throw new Error('Something went wrong. Please try again.')
  }
}
