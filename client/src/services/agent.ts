import axios from 'axios'
import type {
  AgentSessionResponse,
  StartInvestigationRequest,
} from '../types/agent'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3000',
  timeout: 250_000,
})

function requestError(error: unknown): Error {
  if (axios.isAxiosError<{ error?: string }>(error)) {
    if (error.response?.data.error) {
      return new Error(error.response.data.error)
    }
    if (!error.response) {
      return new Error(
        'Could not connect to KrishiLens. Check that the backend is running and try again.',
      )
    }
  }
  return new Error('The investigation could not be completed. Please try again.')
}

export async function startInvestigation(
  request: StartInvestigationRequest,
): Promise<AgentSessionResponse> {
  try {
    const response = await api.post<AgentSessionResponse>(
      '/api/agent/investigate',
      {
        scanId: request.scanId,
        crop: request.crop,
        language: request.language,
        question: request.question,
      },
      { headers: { Authorization: `Bearer ${request.scanAccessToken}` } },
    )
    return response.data
  } catch (error) {
    throw requestError(error)
  }
}

export async function answerInvestigation(
  sessionId: string,
  accessToken: string,
  answer: string,
): Promise<AgentSessionResponse> {
  try {
    const response = await api.post<AgentSessionResponse>(
      `/api/agent/${sessionId}/answer`,
      { answer },
      { headers: { Authorization: `Bearer ${accessToken}` } },
    )
    return response.data
  } catch (error) {
    throw requestError(error)
  }
}

export async function getInvestigation(
  sessionId: string,
  accessToken: string,
): Promise<AgentSessionResponse> {
  try {
    const response = await api.get<AgentSessionResponse>(
      `/api/agent/${sessionId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    )
    return response.data
  } catch (error) {
    throw requestError(error)
  }
}
