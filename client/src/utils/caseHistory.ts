import type { Crop } from '../types/cropAnalysis'

export function formatCaseDate(value: string | null, language: string): string {
  if (!value) return '—'
  return new Intl.DateTimeFormat(language === 'bn' ? 'bn-BD' : 'en', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export function cropChoices(): Crop[] {
  return ['rice', 'wheat', 'maize', 'jute', 'other']
}
