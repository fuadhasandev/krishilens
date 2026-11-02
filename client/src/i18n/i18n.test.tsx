import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import App from '../App'
import i18n, { languageStorageKey, readSavedLanguage } from './index'
import en from './locales/en.json'
import bn from './locales/bn.json'

function keyPaths(value: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(value).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key
    return child && typeof child === 'object' && !Array.isArray(child)
      ? keyPaths(child as Record<string, unknown>, path)
      : [path]
  })
}

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) {
      return sourceFiles(path)
    }
    return entry.isFile() && path.endsWith('.tsx') ? [path] : []
  })
}

describe('KrishiLens bilingual interface', () => {
  beforeEach(async () => {
    localStorage.clear()
    await i18n.changeLanguage('en')
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('defaults new users to English and restores only supported preferences', () => {
    expect(readSavedLanguage()).toBe('en')
    localStorage.setItem(languageStorageKey, 'fr')
    expect(readSavedLanguage()).toBe('en')
    localStorage.setItem(languageStorageKey, 'bn')
    expect(readSavedLanguage()).toBe('bn')
  })

  it('starts in English and switches the home interface without losing form data', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    )
    expect(screen.getByRole('heading', { name: 'Smarter Crop Care Starts Here.' })).toBeInTheDocument()
    expect(screen.getByText('Smarter Farming Starts Here')).toBeInTheDocument()
    expect(screen.getByText('Upload a crop photo')).toBeInTheDocument()
    const question = screen.getByRole('textbox', { name: /What have you observed/ })
    await user.type(question, 'Brown marks on leaves')
    await user.click(screen.getByRole('button', { name: 'বাংলা' }))

    expect(await screen.findByText('এআই-চালিত ছবির বিশ্লেষণ, পরবর্তী প্রশ্ন এবং নিয়মিত পর্যবেক্ষণের মাধ্যমে ফসলের সমস্যা খতিয়ে দেখুন।')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'ফসলের যত্নে বুদ্ধিমান সহায়তার শুরু এখানেই।' })).toBeInTheDocument()
    expect(screen.getByText('ফসলের ছবি দিন')).toBeInTheDocument()
    expect(screen.getByText('ফসলের উন্নত যত্ন শুরু হোক এখানেই।')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /আপনি কী লক্ষ করেছেন/ })).toHaveValue('Brown marks on leaves')
    await waitFor(() => expect(document.documentElement.lang).toBe('bn'))
    expect(localStorage.getItem(languageStorageKey)).toBe('bn')
    expect(screen.getByRole('button', { name: 'বাংলা' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('renders the English image-analysis labels and updates them to Bangla', async () => {
    const user = userEvent.setup()
    await i18n.changeLanguage('en')
    render(
      <MemoryRouter initialEntries={['/image-analysis']}>
        <App />
      </MemoryRouter>,
    )
    expect(screen.getByRole('heading', { name: 'Segment a crop image' })).toBeInTheDocument()
    expect(screen.getByText('Candidate visual region')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'বাংলা' }))
    expect(await screen.findByRole('heading', { name: 'ফসলের ছবির অংশ চিহ্নিত করুন' })).toBeInTheDocument()
    expect(screen.getByText('যে দৃশ্যমান অংশটি খুঁজবেন')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'বাংলা' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('localizes stable API error codes', async () => {
    await i18n.changeLanguage('bn')
    expect(i18n.t('errors.INVALID_IMAGE')).toBe('৪ এমবি বা তার কম আকারের JPEG, PNG বা WebP ছবি বেছে নিন।')
    await i18n.changeLanguage('en')
    expect(i18n.t('errors.INVALID_IMAGE')).toBe('Choose a valid JPEG, PNG, or WebP image up to 4 MB.')
  })

  it('localizes case history and re-check labels in both supported languages', async () => {
    await i18n.changeLanguage('en')
    expect(i18n.t('caseHistory.title')).toBe('Crop case history')
    expect(i18n.t('caseHistory.comparisonLimitations')).toContain('does not prove recovery')
    await i18n.changeLanguage('bn')
    expect(i18n.t('caseHistory.title')).toBe('ফসলের কেসের ইতিহাস')
    expect(i18n.t('caseHistory.comparisonLimitations')).toContain('প্রমাণ হয় না')
  })

  it('keeps the translation dictionaries in parity', () => {
    expect(keyPaths(en).sort()).toEqual(keyPaths(bn).sort())
  })

  it('does not leave static visible English copy or accessibility text in app components', () => {
    const appFiles = [
      resolve(process.cwd(), 'src/App.tsx'),
      ...sourceFiles(resolve(process.cwd(), 'src/components')),
      ...sourceFiles(resolve(process.cwd(), 'src/pages')),
    ]
    const untranslated = appFiles.flatMap((file) => {
      const source = readFileSync(file, 'utf8')
      const jsxCopy = [...source.matchAll(/>([^<>{}\n]+)<\//g)]
        .map((match) => match[1]?.trim() ?? '')
        .filter((text) => /[A-Za-z]/.test(text) && text !== 'KrishiLens')
      const staticAttributes = [
        ...source.matchAll(/\b(?:aria-label|alt|placeholder|title)\s*=\s*["']([^"']+)["']/g),
      ].map((match) => match[1] ?? '')
      return [...jsxCopy, ...staticAttributes].map((text) => ({ file, text }))
    })
    expect(untranslated).toEqual([])
  })

  it('includes the selected language in the image-analysis request body', async () => {
    const { createImageAnalysisFormData } = await import('../services/imageAnalysis')
    const formData = createImageAnalysisFormData({
      image: new File(['image'], 'leaf.jpg', { type: 'image/jpeg' }),
      crop: 'rice',
      target: 'brown spots',
      language: 'en',
    })
    expect(formData.get('language')).toBe('en')
    expect(formData.get('crop')).toBe('rice')
  })
})
