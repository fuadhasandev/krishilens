import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { loadScanImage, scheduleRecheck, submitRecheck } from '../services/cases'
import { formatCaseDate } from '../utils/caseHistory'
import { isSupportedImageUpload } from '../utils/imageUpload'
import type { CaseRecheck, CaseScan, CropCase } from '../types/cases'

export function CaseCard({ cropCase }: { cropCase: CropCase }) {
  const { t, i18n } = useTranslation()
  const dueDate = cropCase.nextRecheckAt
  const overdue = cropCase.isRecheckOverdue ?? false
  return (
    <article className="rounded-2xl border border-[#e5ebdf] bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[#183b2c]">
            {t(`common.${cropCase.crop}`)} · {cropCase.caseId.slice(0, 8)}
          </h2>
          <p className="mt-1 text-sm text-[#617166]">
            {t('caseHistory.updated')}: {formatCaseDate(cropCase.updatedAt, i18n.language)}
          </p>
        </div>
        {dueDate && (
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${overdue ? 'bg-[#fff0e8] text-[#854735]' : 'bg-[#e9f1e4] text-[#326548]'}`}>
            {t(overdue ? 'caseHistory.overdue' : 'caseHistory.upcoming')}: {formatCaseDate(dueDate, i18n.language)}
          </span>
        )}
      </div>
      <p className="mt-3 text-sm text-[#617166]">
        {t('caseHistory.caseStatus')}: {t(`caseHistory.${cropCase.status === 'needs_follow_up' ? 'needsFollowUp' : cropCase.status}`)}
      </p>
      <Link
        className="mt-4 inline-flex min-h-10 items-center rounded-lg bg-[#1f603f] px-4 py-2 text-sm font-semibold text-white hover:bg-[#194d33] focus:outline-none focus:ring-2 focus:ring-[#4c8456]"
        to={`/cases/${cropCase.caseId}`}
      >
        {t('caseHistory.open')}
      </Link>
    </article>
  )
}

function dateTimeLocal(value: string | null): string {
  if (!value) return ''
  const date = new Date(value)
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
  return date.toISOString().slice(0, 16)
}

function ScanImage({ caseId, scan }: { caseId: string; scan: CaseScan }) {
  const { t } = useTranslation()
  const [url, setUrl] = useState('')
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let active = true
    let objectUrl = ''
    void loadScanImage(caseId, scan.scanId).then((nextUrl) => {
      objectUrl = nextUrl
      if (active) setUrl(nextUrl)
      else URL.revokeObjectURL(nextUrl)
    }).catch(() => {
      if (active) setFailed(true)
    })
    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [caseId, scan.scanId])

  if (failed) return <div className="flex aspect-video items-center justify-center rounded-xl bg-[#f1f5ed] p-3 text-sm text-[#617166]">{t('errors.IMAGE_NOT_FOUND')}</div>
  if (!url) return <div aria-label={t('common.loading')} className="aspect-video animate-pulse rounded-xl bg-[#f1f5ed]" />
  return <img alt={t('caseHistory.imageAlt')} className="aspect-video w-full rounded-xl object-cover" src={url} />
}

function ScanSummary({ scan }: { scan: CaseScan }) {
  const { t, i18n } = useTranslation()
  const amount = scan.affectedPercent === null
    ? t('reports.measurementMissing')
    : `${new Intl.NumberFormat(i18n.language === 'bn' ? 'bn-BD' : 'en', { maximumFractionDigits: 1 }).format(scan.affectedPercent)}%`
  return (
    <dl className="mt-3 grid gap-1 text-sm text-[#617166]">
      <div className="flex justify-between gap-2"><dt>{t('imageAnalysis.processedImage', { width: scan.image.width, height: scan.image.height })}</dt><dd>{formatCaseDate(scan.createdAt, i18n.language)}</dd></div>
      <div className="flex justify-between gap-2"><dt>{t('caseHistory.currentMeasurement')}</dt><dd>{amount}</dd></div>
      <div className="flex justify-between gap-2"><dt>{t('reports.measurementQuality')}</dt><dd>{t(`imageAnalysis.${scan.measurementQuality === 'accepted' ? 'maskAvailable' : scan.measurementQuality === 'needs_review' ? 'needsReview' : 'measurementUnavailable'}`)}</dd></div>
    </dl>
  )
}

export function ScanHistory({ caseId, scans }: { caseId: string; scans: CaseScan[] }) {
  const { t } = useTranslation()
  if (!scans.length) return <p className="rounded-xl bg-[#f1f5ed] p-4 text-sm text-[#617166]">{t('caseHistory.noScans')}</p>
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {scans.map((scan) => (
        <article className="rounded-2xl border border-[#e5ebdf] p-4" key={scan.scanId}>
          <ScanImage caseId={caseId} scan={scan} />
          <ScanSummary scan={scan} />
        </article>
      ))}
    </div>
  )
}

export function ScanComparison({
  caseId,
  scans,
  recheck,
}: {
  caseId: string
  scans: CaseScan[]
  recheck: CaseRecheck
}) {
  const { t, i18n } = useTranslation()
  const comparison = recheck.comparison
  const previousScan = scans.find((scan) => scan.scanId === recheck.previousScanId)
  const currentScan = scans.find((scan) => scan.scanId === recheck.currentScanId)
  const number = (value: number | null) => value === null
    ? '—'
    : `${new Intl.NumberFormat(i18n.language === 'bn' ? 'bn-BD' : 'en', { maximumFractionDigits: 1 }).format(value)}%`
  return (
    <section className="space-y-3 rounded-xl border border-[#e5ebdf] bg-[#fbfcf9] p-4">
      <h3 className="font-semibold">{t('caseHistory.comparison')}</h3>
      <p className="font-medium text-[#315d3d]">
        {t(`caseHistory.${comparison?.assessment === 'possible_improvement' ? 'possibleImprovement' : comparison?.assessment === 'possible_worsening' ? 'possibleWorsening' : 'inconclusive'}`)}
      </p>
      {(previousScan || currentScan) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {previousScan && <div><p className="mb-1 text-xs text-[#617166]">{t('caseHistory.previousMeasurement')}</p><ScanImage caseId={caseId} scan={previousScan} /></div>}
          {currentScan && <div><p className="mb-1 text-xs text-[#617166]">{t('caseHistory.currentMeasurement')}</p><ScanImage caseId={caseId} scan={currentScan} /></div>}
        </div>
      )}
      <dl className="grid gap-2 text-sm sm:grid-cols-3">
        <div><dt className="text-[#617166]">{t('caseHistory.previousMeasurement')}</dt><dd>{number(comparison?.previousAffectedPercent ?? null)}</dd></div>
        <div><dt className="text-[#617166]">{t('caseHistory.currentMeasurement')}</dt><dd>{number(comparison?.currentAffectedPercent ?? null)}</dd></div>
        <div><dt className="text-[#617166]">{t('caseHistory.percentagePointChange')}</dt><dd>{comparison?.percentagePointChange === null || comparison?.percentagePointChange === undefined ? '—' : new Intl.NumberFormat(i18n.language === 'bn' ? 'bn-BD' : 'en', { maximumFractionDigits: 1 }).format(comparison.percentagePointChange)}</dd></div>
      </dl>
      <p className="text-sm leading-6 text-[#617166]">{t('caseHistory.comparisonLimitations')}</p>
    </section>
  )
}

export function ProgressAssessment({ recheck }: { recheck: CaseRecheck }) {
  const { t, i18n } = useTranslation()
  return (
    <aside className="rounded-xl border border-[#dce6d6] bg-[#f1f5ed] p-4">
      <h3 className="font-semibold">{t('caseHistory.progressAssessment')}</h3>
      <p className="mt-2 text-sm leading-6">{recheck.assessment.text}</p>
      {recheck.comparison === null ? (
        <p className="mt-2 text-xs text-[#617166]">{t('caseHistory.noComparisonNote')}</p>
      ) : recheck.assessment.generatedBy === 'fallback' && (
        <p className="mt-2 text-xs text-[#617166]">{t('caseHistory.modelFallback')}</p>
      )}
      {recheck.assessment.language !== (i18n.language === 'en' ? 'en' : 'bn') && (
        <p className="mt-2 text-xs text-[#617166]">{t('caseHistory.reportLanguage')}: {t(`common.${recheck.assessment.language === 'bn' ? 'bangla' : 'english'}`)}</p>
      )}
      <p className="mt-2 text-xs text-[#617166]">{t('caseHistory.visibleOnly')}</p>
    </aside>
  )
}

export function RecheckTimeline({
  caseId,
  rechecks,
  scans,
}: {
  caseId: string
  rechecks: CaseRecheck[]
  scans: CaseScan[]
}) {
  const { t, i18n } = useTranslation()
  if (!rechecks.length) return <p className="rounded-xl bg-[#f1f5ed] p-4 text-sm text-[#617166]">{t('caseHistory.noRechecks')}</p>
  return (
    <ol className="space-y-4 border-l-2 border-[#dce6d6] pl-4">
      {rechecks.map((recheck) => (
        <li className="space-y-3" key={recheck.recheckId}>
          <p className="text-sm font-semibold">{formatCaseDate(recheck.completedAt, i18n.language)}</p>
          <ScanComparison caseId={caseId} recheck={recheck} scans={scans} />
          <ProgressAssessment recheck={recheck} />
          {recheck.observations && <p className="text-sm text-[#617166]">{recheck.observations}</p>}
        </li>
      ))}
    </ol>
  )
}

export function RecheckReminder({
  cropCase,
  onSaved,
}: {
  cropCase: CropCase
  onSaved: (date: string | null) => void
}) {
  const { t, i18n } = useTranslation()
  const [date, setDate] = useState(
    dateTimeLocal(cropCase.nextRecheckAt),
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const dueDate = cropCase.nextRecheckAt
  const overdue = cropCase.isRecheckOverdue ?? false

  async function save(nextDate: string | null) {
    setBusy(true)
    setError('')
    setSaved(false)
    try {
      const iso = nextDate ? new Date(nextDate).toISOString() : null
      await scheduleRecheck(cropCase.caseId, iso)
      onSaved(iso)
      setDate(dateTimeLocal(iso))
      setSaved(true)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'REQUEST_FAILED')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="space-y-3 rounded-2xl border border-[#e5ebdf] bg-white p-5">
      <h2 className="text-lg font-semibold">{t('caseHistory.schedule')}</h2>
      {dueDate ? (
        <p className={`text-sm font-medium ${overdue ? 'text-[#854735]' : 'text-[#326548]'}`}>
          {t(overdue ? 'caseHistory.overdue' : 'caseHistory.upcoming')}: {formatCaseDate(dueDate, i18n.language)}
        </p>
      ) : <p className="text-sm text-[#617166]">{t('caseHistory.noReminder')}</p>}
      <div className="flex flex-wrap gap-2">
        <label className="flex min-h-11 flex-1 flex-col gap-1 text-sm font-medium">
          <span>{t('caseHistory.scheduleDate')}</span>
          <input className="min-h-11 rounded-lg border border-[#dce6d6] bg-[#fbfcf9] px-3" onChange={(event) => setDate(event.target.value)} type="datetime-local" value={date} />
        </label>
        <button className="mt-auto min-h-11 rounded-lg bg-[#1f603f] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" disabled={!date || busy} onClick={() => void save(date)} type="button">{busy ? t('caseHistory.saving') : t('caseHistory.saveDate')}</button>
        {dueDate && <button className="mt-auto min-h-11 rounded-lg border border-[#dce6d6] px-4 py-2 text-sm font-semibold disabled:opacity-60" disabled={busy} onClick={() => void save(null)} type="button">{t('caseHistory.clearDate')}</button>}
      </div>
      {saved && <p aria-live="polite" className="text-sm text-[#326548]" role="status">{t('caseHistory.dateSaved')}</p>}
      {error && <p aria-live="polite" className="text-sm text-[#854735]" role="alert">{t(`errors.${error}`, { defaultValue: t('errors.REQUEST_FAILED') })}</p>}
    </section>
  )
}

export function RecheckForm({
  caseId,
  scans,
  onComplete,
}: {
  caseId: string
  scans: CaseScan[]
  onComplete: (recheck: CaseRecheck) => void
}) {
  const { t, i18n } = useTranslation()
  const [image, setImage] = useState<File | null>(null)
  const [observations, setObservations] = useState('')
  const [previousScanId, setPreviousScanId] = useState(scans[0]?.scanId ?? '')
  const [similarLighting, setSimilarLighting] = useState(false)
  const [similarAngle, setSimilarAngle] = useState(false)
  const [samePlantRegion, setSamePlantRegion] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const submissionId = useRef<string | null>(null)
  const qualityFields: Array<{
    checked: boolean
    onChange: (value: boolean) => void
    key: 'similarLighting' | 'similarAngle' | 'samePlantRegion'
  }> = [
    { checked: similarLighting, onChange: setSimilarLighting, key: 'similarLighting' },
    { checked: similarAngle, onChange: setSimilarAngle, key: 'similarAngle' },
    { checked: samePlantRegion, onChange: setSamePlantRegion, key: 'samePlantRegion' },
  ]

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!image) return
    setBusy(true)
    setError('')
    try {
      const result = await submitRecheck(caseId, {
        submissionId: submissionId.current ?? (submissionId.current = crypto.randomUUID()),
        image,
        language: i18n.language === 'en' ? 'en' : 'bn',
        observations,
        ...(previousScanId ? { previousScanId } : {}),
        similarLighting,
        similarAngle,
        samePlantRegion,
      })
      submissionId.current = null
      onComplete(result.recheck)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'REQUEST_FAILED')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="space-y-4 rounded-2xl border border-[#e5ebdf] bg-white p-5" onSubmit={(event) => void submit(event)}>
      <div>
        <h2 className="text-lg font-semibold">{t('caseHistory.uploadTitle')}</h2>
        <p className="mt-1 text-sm leading-6 text-[#617166]">{t('caseHistory.uploadInstructions')}</p>
      </div>
      <label className="block text-sm font-medium">
        {t('caseHistory.chooseImage')}
        <input
          accept="image/jpeg,image/png,image/webp"
          className="mt-2 block w-full text-sm"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (!file) {
              setImage(null)
              return
            }
            if (!isSupportedImageUpload(file)) {
              setImage(null)
              setError('INVALID_IMAGE')
              event.currentTarget.value = ''
              return
            }
            setImage(file)
            setError('')
          }}
          required
          type="file"
        />
      </label>
      <label className="block text-sm font-medium">
        {t('caseHistory.observations')}
        <textarea className="mt-2 min-h-24 w-full rounded-xl border border-[#dce6d6] bg-[#fbfcf9] p-3 text-base" maxLength={2000} onChange={(event) => setObservations(event.target.value)} placeholder={t('caseHistory.observationsPlaceholder')} value={observations} />
      </label>
      {scans.length > 0 && (
        <label className="block text-sm font-medium">
          {t('caseHistory.previousScan')}
          <select className="mt-2 min-h-11 w-full rounded-lg border border-[#dce6d6] bg-[#fbfcf9] px-3" onChange={(event) => setPreviousScanId(event.target.value)} value={previousScanId}>
            {scans.map((scan) => <option key={scan.scanId} value={scan.scanId}>{formatCaseDate(scan.createdAt, i18n.language)} · {scan.scanId.slice(0, 8)}</option>)}
          </select>
        </label>
      )}
      <fieldset className="space-y-2 rounded-xl bg-[#f7f8f2] p-4">
        <legend className="px-1 text-sm font-semibold">{t('caseHistory.samePlantQuestion')}</legend>
        {qualityFields.map(({ checked, onChange, key }) => (
          <label className="flex items-start gap-2 text-sm" key={key}>
            <input checked={checked} className="mt-1 accent-[#1f603f]" onChange={(event) => onChange(event.target.checked)} type="checkbox" />
            {t(`caseHistory.${key}`)}
          </label>
        ))}
      </fieldset>
      {error && <p aria-live="polite" className="rounded-lg bg-[#fff7f4] p-3 text-sm text-[#854735]" role="alert">{t(`errors.${error}`, { defaultValue: t('errors.REQUEST_FAILED') })}</p>}
      <button className="min-h-12 w-full rounded-xl bg-[#1f603f] px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto" disabled={!image || busy} type="submit">{busy ? t('caseHistory.submitting') : t('caseHistory.submitRecheck')}</button>
    </form>
  )
}
