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
  ) {
    super(message)
    this.name = 'MetaServiceError'
  }
}

function createMetaClient(): OpenAI {
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
    timeout: 30_000,
    maxRetries: 0,
  })
}

export async function createMetaResponse(
  systemPrompt: string,
  userPrompt: string,
): Promise<{ answer: string; model: string; requestId: string }> {
  const client = createMetaClient()

  try {
    const response = await client.responses.create({
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

    if (error instanceof APIConnectionTimeoutError) {
      throw new MetaServiceError(
        'The AI service took too long to respond. Please try again.',
        504,
      )
    }

    if (error instanceof APIError && error.status !== undefined) {
      const requestId = error.requestID ?? undefined
      if (error.status === 429) {
        throw new MetaServiceError(
          'The AI service is busy right now. Please wait a moment and try again.',
          429,
          requestId,
        )
      }

      throw new MetaServiceError(
        'The AI service could not complete this request. Please try again later.',
        502,
        requestId,
      )
    }

    if (error instanceof APIConnectionError) {
      throw new MetaServiceError(
        'Could not reach the AI service. Please try again later.',
        502,
      )
    }

    throw new MetaServiceError(
      'An unexpected AI service error occurred. Please try again later.',
      502,
    )
  }
}
