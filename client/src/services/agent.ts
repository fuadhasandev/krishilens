import axios from 'axios'
import type {
  AgentSessionResponse,
  InvestigationLanguage,
  StartInvestigationRequest,
  TranslatedInvestigationText,
} from '../types/agent'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3000',
  timeout: 250_000,
})

function requestError(error: unknown): Error {
  if (axios.isAxiosError<{ errorCode?: string }>(error)) {
    if (error.response?.data.errorCode) {
      return new Error(error.response.data.errorCode)
    }
    if (!error.response) {
      return new Error('NETWORK_ERROR')
    }
  }
  return new Error('INVESTIGATION_FAILED')
}

function authHeader(token: string): { headers: { Authorization: string } } {
  return { headers: { Authorization: 'Bearer ' + token } }
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
      authHeader(request.scanAccessToken),
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
  language: InvestigationLanguage,
): Promise<AgentSessionResponse> {
  try {
    const response = await api.post<AgentSessionResponse>(
      `/api/agent/${sessionId}/answer`,
      { answer, language },
      authHeader(accessToken),
    )
    return response.data
  } catch (error) {
    throw requestError(error)
  }
}

export async function translateInvestigation(
  sessionId: string,
  accessToken: string,
  language: InvestigationLanguage,
): Promise<TranslatedInvestigationText> {
  try {
    const response = await api.post<TranslatedInvestigationText>(
      `/api/agent/${sessionId}/translate`,
      { language },
      authHeader(accessToken),
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
      authHeader(accessToken),
    )
    return response.data
  } catch (error) {
    throw requestError(error)
  }
}
