import axios from 'axios'
import { apiBaseUrl } from './apiBaseUrl'
import type { AppLanguage } from '../i18n'

export type VoiceAuthorization =
  | { scanId: string; accessToken: string }
  | { sessionId: string; accessToken: string }

interface VoiceTranscriptionResponse {
  success: true
  transcript: string
}

const api = axios.create({
  baseURL: apiBaseUrl,
  timeout: 45_000,
})

export async function transcribeVoice(
  audio: Blob,
  language: AppLanguage,
  authorization?: VoiceAuthorization,
): Promise<string> {
  const form = new FormData()
  form.append('audio', audio, 'recording.wav')
  form.append('language', language)
  if (authorization && 'scanId' in authorization) {
    form.append('scanId', authorization.scanId)
  } else if (authorization) {
    form.append('sessionId', authorization.sessionId)
  }

  try {
    const response = await api.post<VoiceTranscriptionResponse>(
      '/api/voice/transcribe',
      form,
      {
        headers: authorization
          ? { Authorization: `Bearer ${authorization.accessToken}` }
          : undefined,
      },
    )
    if (
      response.data.success !== true ||
      typeof response.data.transcript !== 'string' ||
      !response.data.transcript.trim()
    ) {
      throw new Error('TRANSCRIPTION_FAILED')
    }
    return response.data.transcript
  } catch (error) {
    if (error instanceof Error && error.message === 'TRANSCRIPTION_FAILED') {
      throw error
    }
    if (axios.isAxiosError<{ errorCode?: string }>(error)) {
      if (error.response?.data.errorCode) {
        throw new Error(error.response.data.errorCode)
      }
      if (!error.response) {
        throw new Error('NETWORK_ERROR')
      }
    }
    throw new Error('TRANSCRIPTION_FAILED')
  }
}
