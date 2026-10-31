import axios from 'axios'
import type {
  ImageAnalysisRequest,
  ImageAnalysisResponse,
} from '../types/imageAnalysis'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3000',
  timeout: 190_000,
})

export async function analyzeImage(
  request: ImageAnalysisRequest,
): Promise<ImageAnalysisResponse> {
  const formData = new FormData()
  formData.append('image', request.image)
  formData.append('crop', request.crop)
  formData.append('target', request.target)

  try {
    const response = await api.post<ImageAnalysisResponse>(
      '/api/images/segment',
      formData,
    )
    return response.data
  } catch (error) {
    if (axios.isAxiosError<{ error?: string }>(error)) {
      if (error.response?.data.error) {
        throw new Error(error.response.data.error)
      }
      if (!error.response) {
        throw new Error(
          'Could not connect to KrishiLens. Check that the backend is running and try again.',
        )
      }
    }

    throw new Error('Image analysis could not be completed. Please try again.')
  }
}
