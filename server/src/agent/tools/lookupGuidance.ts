import { z } from 'zod'
import type { AgentSession } from '../types.js'
import { searchRiceGuidance } from './riceGuidance.js'

export const lookupGuidanceInputSchema = z
  .object({ query: z.string().trim().min(2).max(400) })
  .strict()

const guidanceSourceSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    url: z.string().url(),
    excerpt: z.string(),
    scope: z.enum(['institutional', 'agronomic']),
  })
  .strict()

export const lookupGuidanceOutputSchema = z
  .object({
    status: z.enum(['results_found', 'no_relevant_evidence']),
    results: z.array(guidanceSourceSchema),
    noEvidence: z.boolean(),
  })
  .strict()

export function lookupGuidance(
  input: z.infer<typeof lookupGuidanceInputSchema>,
  session: AgentSession,
): z.infer<typeof lookupGuidanceOutputSchema> {
  const lookup = searchRiceGuidance(input.query)
  for (const source of lookup.results) {
    if (!session.retrievedSourceIds.includes(source.id)) {
      session.retrievedSourceIds.push(source.id)
    }
  }

  return lookupGuidanceOutputSchema.parse({
    status: lookup.results.some((source) => source.scope === 'agronomic')
      ? 'results_found'
      : 'no_relevant_evidence',
    results: lookup.results.map(({ tags: _tags, ...source }) => source),
    noEvidence: lookup.noEvidence,
  })
}
