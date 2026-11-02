import { useTranslation } from 'react-i18next'
import { supportedLanguages, type AppLanguage } from '../i18n'

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation()

  function changeLanguage(language: AppLanguage) {
    if (i18n.resolvedLanguage !== language) {
      void i18n.changeLanguage(language)
    }
  }

  return (
    <div
      aria-label={t('accessibility.language')}
      className="inline-flex min-h-11 items-center gap-0.5 rounded-xl border border-[#d6e2d3] bg-white p-1"
      role="group"
    >
      {supportedLanguages.map((language) => {
        const selected = i18n.resolvedLanguage === language
        return (
          <button
            aria-pressed={selected}
            className={`min-h-9 min-w-11 rounded-lg px-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2F855A] focus-visible:ring-offset-1 ${selected ? 'bg-[#174D35] text-white' : 'text-[#315d3d] hover:bg-[#EAF4E8]'}`}
            key={language}
            onClick={() => changeLanguage(language)}
            type="button"
          >
            {language === 'bn' ? 'বাংলা' : 'EN'}
          </button>
        )
      })}
    </div>
  )
}
