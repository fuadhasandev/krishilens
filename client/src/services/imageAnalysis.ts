import axios from 'axios'
import type {
  ImageAnalysisRequest,
  ImageAnalysisResponse,
} from '../types/imageAnalysis'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3000',
  timeout: 190_000,
})

export function createImageAnalysisFormData(
  request: ImageAnalysisRequest,
): FormData {
  const formData = new FormData()
  formData.append('image', request.image)
  formData.append('crop', request.crop)
  formData.append('target', request.target)
  formData.append('language', request.language)
  return formData
}

export async function analyzeImage(
  request: ImageAnalysisRequest,
): Promise<ImageAnalysisResponse> {
  const formData = createImageAnalysisFormData(request)

  try {
    const response = await api.post<ImageAnalysisResponse>(
      '/api/images/segment',
      formData,
    )
    return response.data
  } catch (error) {
    if (axios.isAxiosError<{ errorCode?: string }>(error)) {
      if (error.response?.data.errorCode) {
        throw new Error(error.response.data.errorCode)
      }
      if (!error.response) {
        throw new Error('NETWORK_ERROR')
      }
    }

    throw new Error('UPLOAD_FAILED')
  }
}
