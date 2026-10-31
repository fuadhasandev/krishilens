import axios from 'axios'
import { apiBaseUrl } from './apiBaseUrl'
import type {
  CaseDetailsResponse,
  CaseRecheck,
  CaseScan,
  CropCase,
} from '../types/cases'
import type { Crop } from '../types/cropAnalysis'

const api = axios.create({
  baseURL: apiBaseUrl,
  timeout: 290_000,
})

const ownerTokenKey = 'krishilens.case-owner-token'

function ownerToken(): string | null {
  try {
    return window.localStorage.getItem(ownerTokenKey)
  } catch {
    throw new Error('LOCAL_STORAGE_UNAVAILABLE')
  }
}

function saveOwnerToken(token: string): void {
  try {
    window.localStorage.setItem(ownerTokenKey, token)
  } catch {
    throw new Error('LOCAL_STORAGE_UNAVAILABLE')
  }
}

function authHeaders(required = true): { Authorization?: string } {
  const token = ownerToken()
  if (!token && required) throw new Error('CASE_ACCESS_REQUIRED')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

function requestError(error: unknown): Error {
  if (axios.isAxiosError<{ errorCode?: string }>(error)) {
    if (error.response?.data.errorCode) return new Error(error.response.data.errorCode)
    if (!error.response) return new Error('NETWORK_ERROR')
  }
  return error instanceof Error ? error : new Error('REQUEST_FAILED')
}

export async function createCase(input: {
  crop: Crop
  language: 'bn' | 'en'
}): Promise<CropCase> {
  try {
    const response = await api.post<{
      case: CropCase
      ownerAccessToken?: string
    }>('/api/cases', input, { headers: authHeaders(false) })
    if (response.data.ownerAccessToken) saveOwnerToken(response.data.ownerAccessToken)
    return response.data.case
  } catch (error) {
    throw requestError(error)
  }
}

export async function listCases(): Promise<CropCase[]> {
  try {
    const response = await api.get<{ cases: CropCase[] }>('/api/cases', {
      headers: authHeaders(),
    })
    return response.data.cases
  } catch (error) {
    throw requestError(error)
  }
}

export async function getCase(caseId: string): Promise<CaseDetailsResponse> {
  try {
    const response = await api.get<CaseDetailsResponse>(`/api/cases/${caseId}`, {
      headers: authHeaders(),
    })
    return response.data
  } catch (error) {
    throw requestError(error)
  }
}

export async function scheduleRecheck(
  caseId: string,
  nextRecheckAt: string | null,
): Promise<void> {
  try {
    await api.patch(
      `/api/cases/${caseId}/recheck-date`,
      { nextRecheckAt },
      { headers: authHeaders() },
    )
  } catch (error) {
    throw requestError(error)
  }
}

export async function submitRecheck(
  caseId: string,
  input: {
    submissionId: string
    image: File
    language: 'bn' | 'en'
    observations: string
    previousScanId?: string
    similarLighting: boolean
    similarAngle: boolean
    samePlantRegion: boolean
  },
): Promise<{ recheck: CaseRecheck; scan: CaseScan }> {
  const data = new FormData()
  data.append('image', input.image)
  data.append('language', input.language)
  data.append('observations', input.observations)
  if (input.previousScanId) data.append('previousScanId', input.previousScanId)
  data.append('similarLighting', String(input.similarLighting))
  data.append('similarAngle', String(input.similarAngle))
  data.append('samePlantRegion', String(input.samePlantRegion))

  try {
    const response = await api.post<{ recheck: CaseRecheck; scan: CaseScan }>(
      `/api/cases/${caseId}/recheck`,
      data,
      {
        headers: {
          ...authHeaders(),
          'Idempotency-Key': input.submissionId,
        },
      },
    )
    return response.data
  } catch (error) {
    throw requestError(error)
  }
}

export async function loadScanImage(
  caseId: string,
  scanId: string,
): Promise<string> {
  try {
    const response = await api.get<Blob>(
      `/api/cases/${caseId}/scans/${scanId}/image`,
      { headers: authHeaders(), responseType: 'blob' },
    )
    return URL.createObjectURL(response.data)
  } catch (error) {
    throw requestError(error)
  }
}
