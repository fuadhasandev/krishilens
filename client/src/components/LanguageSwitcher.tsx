import { useTranslation } from 'react-i18next'
import { supportedLanguages, type AppLanguage } from '../i18n'

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation()

  function changeLanguage(language: AppLanguage) {
    void i18n.changeLanguage(language)
  }

  return (
    <label className="inline-flex min-h-10 items-center gap-2 text-sm font-medium text-[#31513b]">
      <span className="sr-only">{t('accessibility.language')}</span>
      <select
        aria-label={t('accessibility.language')}
        className="min-h-10 max-w-36 rounded-xl border border-[#dce6d6] bg-white px-3 text-sm font-semibold text-[#315d3d] focus:outline-none focus:ring-2 focus:ring-[#4c8456]"
        onChange={(event) => changeLanguage(event.target.value as AppLanguage)}
        value={i18n.resolvedLanguage === 'en' ? 'en' : 'bn'}
      >
        {supportedLanguages.map((language) => (
          <option key={language} value={language}>
            {language === 'bn' ? 'বাংলা' : 'English'}
          </option>
        ))}
      </select>
    </label>
  )
}
