import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, LoaderCircle } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  RecheckReminder,
  RecheckTimeline,
  ScanHistory,
} from '../components/CaseHistoryComponents'
import { LanguageSwitcher } from '../components/LanguageSwitcher'
import { getCase } from '../services/cases'
import type { CaseDetailsResponse } from '../types/cases'
import { formatCaseDate } from '../utils/caseHistory'

export function CaseDetails() {
  const { t, i18n } = useTranslation()
  const { caseId = '' } = useParams()
  const [details, setDetails] = useState<CaseDetailsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setDetails(await getCase(caseId))
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'REQUEST_FAILED')
    } finally {
      setLoading(false)
    }
  }, [caseId])
  useEffect(() => {
    let active = true
    void getCase(caseId).then((result) => {
      if (active) setDetails(result)
    }).catch((requestError: unknown) => {
      if (active) setError(requestError instanceof Error ? requestError.message : 'REQUEST_FAILED')
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [caseId])

  function updateRecheckDate(date: string | null) {
    setDetails((current) => current
      ? { ...current, case: { ...current.case, nextRecheckAt: date, isRecheckOverdue: false } }
      : current)
  }

  return (
    <main className="min-h-screen bg-[#f7f8f2] text-[#183b2c]">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-5 sm:px-8">
        <Link aria-label={t('caseHistory.title')} className="flex items-center gap-2 text-lg font-bold" to="/cases"><ArrowLeft aria-hidden="true" size={20} />{t('caseHistory.title')}</Link>
        <LanguageSwitcher />
      </header>
      <section className="mx-auto w-full max-w-5xl space-y-6 px-5 pb-16 sm:px-8">
        {loading && <div aria-live="polite" className="flex items-center gap-2 text-sm" role="status"><LoaderCircle aria-hidden="true" className="animate-spin" size={18} />{t('caseHistory.loading')}</div>}
        {error && <div className="space-y-3 rounded-xl border border-[#f1d4cd] bg-[#fff7f4] p-4 text-sm text-[#854735]" role="alert"><p>{t(`errors.${error}`, { defaultValue: t('errors.REQUEST_FAILED') })}</p><button className="font-semibold underline" onClick={() => void refresh()} type="button">{t('caseHistory.retry')}</button></div>}
        {details && (
          <>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-[#4c8456]">{t('caseHistory.caseDetails')}</p>
                <h1 className="mt-1 text-3xl font-semibold tracking-tight">{t(`common.${details.case.crop}`)} · {details.case.caseId.slice(0, 8)}</h1>
                <p className="mt-2 text-sm text-[#617166]">{t('caseHistory.created')}: {formatCaseDate(details.case.createdAt, i18n.language)}</p>
              </div>
              <Link className="inline-flex min-h-11 items-center rounded-lg bg-[#1f603f] px-4 py-2 text-sm font-semibold text-white" to={`/cases/${caseId}/recheck`}>{t('caseHistory.recheck')}</Link>
            </div>
            <RecheckReminder cropCase={details.case} onSaved={updateRecheckDate} />
            <section className="space-y-4 rounded-2xl border border-[#e5ebdf] bg-white p-5">
              <h2 className="text-xl font-semibold">{t('caseHistory.scanHistory')}</h2>
              <ScanHistory caseId={caseId} scans={details.scans} />
            </section>
            <section className="space-y-4 rounded-2xl border border-[#e5ebdf] bg-white p-5">
              <h2 className="text-xl font-semibold">{t('caseHistory.investigations')}</h2>
              {details.investigations.length ? details.investigations.map((investigation) => (
                <article className="rounded-xl bg-[#f7f8f2] p-4" key={investigation.investigationId}>
                  <p className="text-sm text-[#617166]">{formatCaseDate(investigation.createdAt, i18n.language)} · {t('caseHistory.reportLanguage')}: {t(`common.${investigation.language === 'bn' ? 'bangla' : 'english'}`)}</p>
                  <p className="mt-2 font-medium">{investigation.farmerQuestion}</p>
                  {investigation.report && <p className="mt-2 text-sm leading-6">{investigation.report.summary}</p>}
                </article>
              )) : <p className="rounded-xl bg-[#f1f5ed] p-4 text-sm text-[#617166]">{t('caseHistory.noInvestigations')}</p>}
            </section>
            <section className="space-y-4 rounded-2xl border border-[#e5ebdf] bg-white p-5">
              <h2 className="text-xl font-semibold">{t('caseHistory.timeline')}</h2>
              <RecheckTimeline caseId={caseId} rechecks={details.rechecks} scans={details.scans} />
            </section>
          </>
        )}
      </section>
    </main>
  )
}
