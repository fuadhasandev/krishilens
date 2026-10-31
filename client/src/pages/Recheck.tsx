import { useEffect, useState } from 'react'
import { ArrowLeft, LoaderCircle } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { RecheckForm } from '../components/CaseHistoryComponents'
import { LanguageSwitcher } from '../components/LanguageSwitcher'
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
    <main className="min-h-screen bg-[#f7f8f2] text-[#183b2c]">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-5 sm:px-8">
        <Link aria-label={t('caseHistory.caseDetails')} className="flex items-center gap-2 text-lg font-bold" to={`/cases/${caseId}`}><ArrowLeft aria-hidden="true" size={20} />{t('caseHistory.caseDetails')}</Link>
        <LanguageSwitcher />
      </header>
      <section className="mx-auto w-full max-w-3xl space-y-5 px-5 pb-16 sm:px-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{t('caseHistory.recheck')}</h1>
          {details && <p className="mt-2 text-sm text-[#617166]">{t(`common.${details.case.crop}`)} · {caseId.slice(0, 8)}</p>}
        </div>
        {loading && <div aria-live="polite" className="flex items-center gap-2 text-sm" role="status"><LoaderCircle aria-hidden="true" className="animate-spin" size={18} />{t('caseHistory.loading')}</div>}
        {error && <p aria-live="polite" className="rounded-xl border border-[#f1d4cd] bg-[#fff7f4] p-4 text-sm text-[#854735]" role="alert">{t(`errors.${error}`, { defaultValue: t('errors.REQUEST_FAILED') })}</p>}
        {details && <RecheckForm caseId={caseId} onComplete={(recheck) => navigate(`/cases/${caseId}`, { state: { recheckId: recheck.recheckId } })} scans={details.scans} />}
      </section>
    </main>
  )
}
