import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  RecheckReminder,
  RecheckTimeline,
  ScanHistory,
} from '../components/CaseHistoryComponents'
import { Alert, Card, LoadingState, PageHeader, SectionHeader } from '../components/ui'
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
    <main className="min-h-screen bg-[#FAF9F5] text-[#173c2c]">
      <PageHeader backTo="/cases" backLabel={t('caseHistory.title')} />
      <section className="mx-auto w-full max-w-6xl space-y-6 px-5 pb-16 pt-3 sm:px-8 sm:pb-20">
        {loading && <LoadingState>{t('caseHistory.loading')}</LoadingState>}
        {error && <Alert role="alert"><p>{t(`errors.${error}`, { defaultValue: t('errors.REQUEST_FAILED') })}</p><button className="mt-2 font-semibold underline underline-offset-2" onClick={() => void refresh()} type="button">{t('caseHistory.retry')}</button></Alert>}
        {details && (
          <>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <SectionHeader
                eyebrow={t('caseHistory.caseDetails')}
                title={<>{t(`common.${details.case.crop}`)} · {details.case.caseId.slice(0, 8)}</>}
                description={<>{t('caseHistory.created')}: {formatCaseDate(details.case.createdAt, i18n.language)}</>}
                headingLevel={1}
              />
              <Link className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[#174D35] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#103d29] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2F855A] focus-visible:ring-offset-2" to={`/cases/${caseId}/recheck`}>{t('caseHistory.recheck')}</Link>
            </div>
            <RecheckReminder cropCase={details.case} onSaved={updateRecheckDate} />
            <Card className="space-y-4 p-4 sm:p-6">
              <h2 className="text-xl font-semibold">{t('caseHistory.scanHistory')}</h2>
              <ScanHistory caseId={caseId} scans={details.scans} />
            </Card>
            <Card className="space-y-4 p-4 sm:p-6">
              <h2 className="text-xl font-semibold">{t('caseHistory.investigations')}</h2>
              {details.investigations.length ? details.investigations.map((investigation) => (
                <article className="rounded-xl bg-[#f7f8f2] p-4" key={investigation.investigationId}>
                  <p className="text-sm text-[#617166]">{formatCaseDate(investigation.createdAt, i18n.language)} · {t('caseHistory.reportLanguage')}: {t(`common.${investigation.language === 'bn' ? 'bangla' : 'english'}`)}</p>
                  <p className="mt-2 font-medium">{investigation.farmerQuestion}</p>
                  {investigation.report && <p className="mt-2 text-sm leading-6">{investigation.report.summary}</p>}
                </article>
              )) : <p className="rounded-xl bg-[#f1f5ed] p-4 text-sm text-[#617166]">{t('caseHistory.noInvestigations')}</p>}
            </Card>
            <Card className="space-y-4 p-4 sm:p-6">
              <h2 className="text-xl font-semibold">{t('caseHistory.timeline')}</h2>
              <RecheckTimeline caseId={caseId} rechecks={details.rechecks} scans={details.scans} />
            </Card>
          </>
        )}
      </section>
    </main>
  )
}
