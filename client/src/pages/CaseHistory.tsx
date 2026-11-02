import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { LoaderCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { CaseCard } from '../components/CaseHistoryComponents'
import { Alert, Button, Card, EmptyState, LoadingState, PageHeader, SectionHeader, Select } from '../components/ui'
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
    <main className="min-h-screen bg-[#FAF9F5] text-[#173c2c]">
      <PageHeader backTo="/" backLabel={t('navigation.backHome')} />
      <section className="mx-auto w-full max-w-6xl space-y-7 px-5 pb-16 pt-3 sm:px-8 sm:pb-20">
        <SectionHeader headingLevel={1} title={t('caseHistory.title')} description={t('caseHistory.intro')} />
        <Card as="section" className="p-4 sm:p-5">
        <form className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-end" onSubmit={(event) => void handleCreate(event)}>
          <label className="min-w-52 flex-1 text-sm font-medium">
            {t('caseHistory.createCase')}
            <Select className="min-h-12" onChange={(event) => setCrop(event.target.value as Crop)} value={crop}>
              {cropChoices().map((item) => <option key={item} value={item}>{t(`common.${item}`)}</option>)}
            </Select>
          </label>
          <Button className="sm:shrink-0" disabled={creating} type="submit">
            {creating && <LoaderCircle aria-hidden="true" className="animate-spin" size={16} />}
            {creating ? t('caseHistory.creating') : t('caseHistory.create')}
          </Button>
        </form>
        </Card>
        {error && <Alert aria-live="polite" role="alert">{t(`errors.${error}`, { defaultValue: t('errors.REQUEST_FAILED') })}</Alert>}
        {loading ? (
          <LoadingState>{t('caseHistory.loading')}</LoadingState>
        ) : cases.length ? (
          <div className="grid gap-4 md:grid-cols-2">{cases.map((cropCase) => <CaseCard cropCase={cropCase} key={cropCase.caseId} />)}</div>
        ) : (
          <EmptyState>{t('caseHistory.empty')}</EmptyState>
        )}
      </section>
    </main>
  )
}
