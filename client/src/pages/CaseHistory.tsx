import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { ArrowLeft, Leaf, LoaderCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CaseCard } from '../components/CaseHistoryComponents'
import { LanguageSwitcher } from '../components/LanguageSwitcher'
import { currentLanguage } from '../i18n'
import { createCase, listCases } from '../services/cases'
import type { CropCase } from '../types/cases'
import type { Crop } from '../types/cropAnalysis'
import { cropChoices } from '../utils/caseHistory'

export function CaseHistory() {
  const { t } = useTranslation()
  const [cases, setCases] = useState<CropCase[]>([])
  const [crop, setCrop] = useState<Crop>('rice')
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setCases(await listCases())
    } catch (requestError) {
      const code = requestError instanceof Error ? requestError.message : 'REQUEST_FAILED'
      if (code === 'CASE_ACCESS_REQUIRED') setCases([])
      else setError(code)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let active = true
    void listCases().then((items) => {
      if (active) setCases(items)
    }).catch((requestError: unknown) => {
      if (!active) return
      const code = requestError instanceof Error ? requestError.message : 'REQUEST_FAILED'
      if (code === 'CASE_ACCESS_REQUIRED') setCases([])
      else setError(code)
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [])

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setCreating(true)
    setError('')
    try {
      await createCase({ crop, language: currentLanguage() })
      await refresh()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'REQUEST_FAILED')
    } finally {
      setCreating(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f8f2] text-[#183b2c]">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-5 sm:px-8">
        <Link aria-label={t('navigation.backHome')} className="flex items-center gap-2 text-lg font-bold" to="/">
          <ArrowLeft aria-hidden="true" size={20} /><Leaf aria-hidden="true" size={20} />KrishiLens
        </Link>
        <LanguageSwitcher />
      </header>
      <section className="mx-auto w-full max-w-5xl space-y-6 px-5 pb-16 sm:px-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{t('caseHistory.title')}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#617166]">{t('caseHistory.intro')}</p>
        </div>
        <form className="flex flex-wrap items-end gap-3 rounded-2xl border border-[#e5ebdf] bg-white p-5 shadow-sm" onSubmit={(event) => void handleCreate(event)}>
          <label className="min-w-52 flex-1 text-sm font-medium">
            {t('caseHistory.createCase')}
            <select className="mt-2 min-h-11 w-full rounded-lg border border-[#dce6d6] bg-[#fbfcf9] px-3" onChange={(event) => setCrop(event.target.value as Crop)} value={crop}>
              {cropChoices().map((item) => <option key={item} value={item}>{t(`common.${item}`)}</option>)}
            </select>
          </label>
          <button className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#1f603f] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" disabled={creating} type="submit">
            {creating && <LoaderCircle aria-hidden="true" className="animate-spin" size={16} />}
            {creating ? t('caseHistory.creating') : t('caseHistory.create')}
          </button>
        </form>
        {error && <p aria-live="polite" className="rounded-xl border border-[#f1d4cd] bg-[#fff7f4] p-4 text-sm text-[#854735]" role="alert">{t(`errors.${error}`, { defaultValue: t('errors.REQUEST_FAILED') })}</p>}
        {loading ? (
          <div aria-live="polite" className="flex items-center gap-2 text-sm text-[#617166]" role="status"><LoaderCircle aria-hidden="true" className="animate-spin" size={18} />{t('caseHistory.loading')}</div>
        ) : cases.length ? (
          <div className="grid gap-4 md:grid-cols-2">{cases.map((cropCase) => <CaseCard cropCase={cropCase} key={cropCase.caseId} />)}</div>
        ) : (
          <p className="rounded-2xl border border-dashed border-[#cbd8c4] bg-white/70 p-6 text-sm leading-6 text-[#617166]">{t('caseHistory.empty')}</p>
        )}
      </section>
    </main>
  )
}
