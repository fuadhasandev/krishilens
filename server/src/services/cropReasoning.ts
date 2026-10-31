import { createMetaResponse } from './meta.js'

export type CropLanguage = 'bn' | 'en'

export interface CropQuestion {
  crop: string
  question: string
  language: CropLanguage
}

export interface CropReasoningResult {
  answer: string
  model: string
  requestId: string
}

const systemPrompt = `You are KrishiLens, a cautious agricultural investigation assistant for smallholder farmers.
Provide practical, plain-language guidance based only on the farmer's text. Do not claim to have seen, analyzed, or diagnosed an image; no image was provided. Never present a disease diagnosis as confirmed from a short text description. Explain uncertainty and distinguish possibilities from facts. Ask a small number of useful follow-up questions about observable signs (such as affected plant parts, spread, timing, water, and nearby plants) when evidence is incomplete. Do not invent scientific references, citations, or local facts. Do not recommend unsupported pesticides, dosages, or treatments. If evidence is insufficient or the issue may cause significant crop loss, recommend consulting a qualified agricultural officer. Give safe, general next steps and answer in the requested language.`

export async function investigateCrop(
  input: CropQuestion,
): Promise<CropReasoningResult> {
  const language =
    input.language === 'bn'
      ? 'Bangla (বাংলা)'
      : 'English'

  const userPrompt = `Respond in ${language}.
Crop: ${input.crop}
Farmer's question: ${input.question}

Give a concise, helpful investigation response. State what can and cannot be inferred, ask relevant follow-up questions if needed, and avoid a confirmed diagnosis.`

  return createMetaResponse(systemPrompt, userPrompt)
}
