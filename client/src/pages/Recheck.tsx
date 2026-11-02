import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { RecheckForm } from '../components/CaseHistoryComponents'
import { LoadingState, PageHeader, SectionHeader } from '../components/ui'
import { getCase } from '../services/cases'
import type { CaseDetailsResponse } from '../types/cases'

export function Recheck() {
  const { t } = useTranslation()
  const { caseId = '' } = useParams()
  const navigate = useNavigate()
  const [details, setDetails] = useState<CaseDetailsResponse | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

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

  return (
    <main className="min-h-screen bg-[#FAF9F5] text-[#173c2c]">
      <PageHeader backTo={`/cases/${caseId}`} backLabel={t('caseHistory.caseDetails')} />
      <section className="mx-auto w-full max-w-3xl space-y-5 px-5 pb-16 pt-3 sm:px-8 sm:pb-20">
        <SectionHeader
          title={t('caseHistory.recheck')}
          description={details && <>{t(`common.${details.case.crop}`)} · {caseId.slice(0, 8)}</>}
          headingLevel={1}
        />
        {loading && <LoadingState>{t('caseHistory.loading')}</LoadingState>}
        {error && <p aria-live="polite" className="rounded-xl border border-[#f1d4cd] bg-[#fff7f4] p-4 text-sm text-[#854735]" role="alert">{t(`errors.${error}`, { defaultValue: t('errors.REQUEST_FAILED') })}</p>}
        {details && <RecheckForm caseId={caseId} onComplete={(recheck) => navigate(`/cases/${caseId}`, { state: { recheckId: recheck.recheckId } })} scans={details.scans} />}
      </section>
    </main>
  )
}
