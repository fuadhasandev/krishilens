export interface GuidanceSource {
  id: string
  title: string
  url: string
  excerpt: string
  tags: string[]
  scope: 'institutional' | 'agronomic'
}

export const riceGuidanceSources: GuidanceSource[] = [
  {
    id: 'brri-official-portal',
    title: 'Bangladesh Rice Research Institute (BRRI) official portal',
    url: 'https://brri.gov.bd/',
    excerpt:
      'BRRI’s official portal lists its institutional mandate, public services, and rice research program sections. This record supports referral to the national rice research institution only; it does not provide symptom-specific diagnosis or treatment guidance.',
    tags: ['rice', 'bangladesh', 'brri', 'research', 'extension', 'ধান'],
    scope: 'institutional',
  },
]

export function searchRiceGuidance(query: string): {
  results: GuidanceSource[]
  noEvidence: boolean
} {
  const normalized = query.toLocaleLowerCase()
  const isBangladeshRiceQuery =
    /\brice\b|\bbangladesh\b|\bbrri\b|ধান|বাংলাদেশ/i.test(normalized)
  const results = isBangladeshRiceQuery ? riceGuidanceSources : []
  return {
    results,
    noEvidence: !results.some((source) => source.scope === 'agronomic'),
  }
}
