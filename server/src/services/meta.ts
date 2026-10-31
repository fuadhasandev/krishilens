import OpenAI, {
  APIError,
  APIConnectionError,
  APIConnectionTimeoutError,
} from 'openai'

export const META_MODEL = 'muse-spark-1.3'

const META_BASE_URL =
  process.env.META_BASE_URL?.trim() || 'https://api.meta.ai/v1'

export class MetaServiceError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
    readonly requestId?: string,
    readonly diagnosticCode?: string,
    readonly diagnosticParam?: string,
  ) {
    super(message)
    this.name = 'MetaServiceError'
  }
}

export type MetaResponseRequest = OpenAI.Responses.ResponseCreateParamsNonStreaming
export type MetaResponse = OpenAI.Responses.Response

function createMetaClient(timeout = 30_000): OpenAI {
  const apiKey = process.env.MODEL_API_KEY?.trim()
  if (!apiKey) {
    throw new MetaServiceError(
      'AI analysis is not configured yet. Please try again later.',
      503,
    )
  }

  return new OpenAI({
    apiKey,
    baseURL: META_BASE_URL,
    timeout,
    maxRetries: 1,
  })
}

function safeDiagnosticCode(value: unknown): string | undefined {
  return typeof value === 'string' && /^[a-zA-Z0-9._-]{1,80}$/.test(value)
    ? value
    : undefined
}

function safeDiagnosticParam(value: unknown): string | undefined {
  return typeof value === 'string' &&
    /^[a-zA-Z0-9._\[\]-]{1,120}$/.test(value)
    ? value
    : undefined
}

function sanitizeMetaError(error: unknown): MetaServiceError {
  if (error instanceof MetaServiceError) {
    return error
  }

  if (
    error instanceof APIConnectionTimeoutError ||
    (error instanceof Error &&
      (error.name === 'AbortError' || error.name === 'TimeoutError'))
  ) {
    return new MetaServiceError(
      'The AI service took too long to respond. Please try again.',
      504,
    )
  }

  if (error instanceof APIError && error.status !== undefined) {
    const requestId = error.requestID ?? undefined
    const diagnosticCode =
      safeDiagnosticCode(error.code) ?? safeDiagnosticCode(error.type)
    const diagnosticParam = safeDiagnosticParam(error.param)
    if (error.status === 429) {
      return new MetaServiceError(
        'The AI service is busy right now. Please wait a moment and try again.',
        429,
        requestId,
        diagnosticCode,
        diagnosticParam,
      )
    }

    return new MetaServiceError(
      'The AI service could not complete this request. Please try again later.',
      502,
      requestId,
      diagnosticCode,
      diagnosticParam,
    )
  }

  if (error instanceof APIConnectionError) {
    return new MetaServiceError(
      'Could not reach the AI service. Please try again later.',
      502,
    )
  }

  return new MetaServiceError(
    'An unexpected AI service error occurred. Please try again later.',
    502,
  )
}

export async function createMetaToolResponse(
  request: MetaResponseRequest,
  signal?: AbortSignal,
  requestTimeoutMs = 30_000,
): Promise<MetaResponse> {
  const client = createMetaClient(requestTimeoutMs)
  try {
    return await client.responses.create(
      request,
      { ...(signal ? { signal } : {}), timeout: requestTimeoutMs },
    )
  } catch (error) {
    throw sanitizeMetaError(error)
  }
}

export async function createMetaResponse(
  systemPrompt: string,
  userPrompt: string,
): Promise<{ answer: string; model: string; requestId: string }> {
  try {
    const response = await createMetaToolResponse({
      model: META_MODEL,
      input: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    })

    const answer = response.output_text.trim()
    if (!answer) {
      throw new MetaServiceError(
        'The AI service returned no answer. Please try again.',
        502,
        response.id,
      )
    }

    return {
      answer,
      model: response.model || META_MODEL,
      requestId: response.id,
    }
  } catch (error) {
    if (error instanceof MetaServiceError) {
      throw error
    }
    throw sanitizeMetaError(error)
  }
}
