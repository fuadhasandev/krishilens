import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './locales/en.json'
import bn from './locales/bn.json'

export const supportedLanguages = ['bn', 'en'] as const
export type AppLanguage = (typeof supportedLanguages)[number]
export const languageStorageKey = 'krishilens.language'

export function readSavedLanguage(): AppLanguage {
  try {
    const saved = window.localStorage.getItem(languageStorageKey)
    return supportedLanguages.includes(saved as AppLanguage)
      ? (saved as AppLanguage)
      : 'bn'
  } catch {
    return 'bn'
  }
}

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, bn: { translation: bn } },
  lng: readSavedLanguage(),
  fallbackLng: 'bn',
  supportedLngs: supportedLanguages,
  interpolation: { escapeValue: false },
  returnNull: false,
})

function updateDocumentLanguage(language: string): void {
  const resolved: AppLanguage = language === 'en' ? 'en' : 'bn'
  document.documentElement.lang = resolved
  document.title = i18n.t('home.documentTitle')
  const description = document.querySelector<HTMLMetaElement>(
    'meta[name="description"]',
  )
  if (description) {
    description.content = i18n.t('home.documentDescription')
  }
  try {
    window.localStorage.setItem(languageStorageKey, resolved)
  } catch {
    // Language changes still apply for the current page when storage is unavailable.
  }
}

updateDocumentLanguage(i18n.resolvedLanguage ?? i18n.language)
i18n.on('languageChanged', updateDocumentLanguage)

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation'
    resources: {
      translation: typeof en
    }
    returnNull: false
  }
}

export function currentLanguage(): AppLanguage {
  return i18n.resolvedLanguage === 'en' ? 'en' : 'bn'
}

export default i18n
