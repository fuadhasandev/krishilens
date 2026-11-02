import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { loadScanImage, scheduleRecheck, submitRecheck } from '../services/cases'
import { Alert, Badge, Button, Card, Input, Select, Textarea } from './ui'
import { formatCaseDate } from '../utils/caseHistory'
import { isSupportedImageUpload } from '../utils/imageUpload'
import type { CaseRecheck, CaseScan, CropCase } from '../types/cases'

export function CaseCard({ cropCase }: { cropCase: CropCase }) {
  const { t, i18n } = useTranslation()
  const dueDate = cropCase.nextRecheckAt
  const overdue = cropCase.isRecheckOverdue ?? false
  return (
    <Card as="article" className="p-5 transition-shadow hover:shadow-[0_12px_30px_rgba(23,77,53,0.08)] sm:p-6">
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
          <Badge tone={overdue ? 'amber' : 'green'}>
            {t(overdue ? 'caseHistory.overdue' : 'caseHistory.upcoming')}: {formatCaseDate(dueDate, i18n.language)}
          </Badge>
        )}
      </div>
      <p className="mt-3 text-sm text-[#617166]">
        {t('caseHistory.caseStatus')}: {t(`caseHistory.${cropCase.status === 'needs_follow_up' ? 'needsFollowUp' : cropCase.status}`)}
      </p>
      <Link
        className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-[#174D35] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#103d29] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2F855A] focus-visible:ring-offset-2"
        to={`/cases/${cropCase.caseId}`}
      >
        {t('caseHistory.open')}
      </Link>
    </Card>
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
        <Card as="article" className="p-4" key={scan.scanId}>
          <ScanImage caseId={caseId} scan={scan} />
          <ScanSummary scan={scan} />
        </Card>
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
    <section className="space-y-3 rounded-2xl border border-[#e2e9de] bg-[#fbfcf9] p-4 sm:p-5">
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
    <aside className="rounded-2xl border border-[#d6e2d3] bg-[#EAF4E8] p-4 sm:p-5">
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
    <Card as="section" className="space-y-3 p-4 sm:p-5">
      <h2 className="text-lg font-semibold">{t('caseHistory.schedule')}</h2>
      {dueDate ? (
        <p className={`text-sm font-medium ${overdue ? 'text-[#854735]' : 'text-[#326548]'}`}>
          {t(overdue ? 'caseHistory.overdue' : 'caseHistory.upcoming')}: {formatCaseDate(dueDate, i18n.language)}
        </p>
      ) : <p className="text-sm text-[#617166]">{t('caseHistory.noReminder')}</p>}
      <div className="flex flex-wrap gap-2">
        <label className="flex min-h-11 flex-1 flex-col gap-1 text-sm font-medium">
          <span>{t('caseHistory.scheduleDate')}</span>
          <Input className="min-h-11" onChange={(event) => setDate(event.target.value)} type="datetime-local" value={date} />
        </label>
        <Button className="mt-auto min-h-11 py-2" disabled={!date || busy} onClick={() => void save(date)} type="button">{busy ? t('caseHistory.saving') : t('caseHistory.saveDate')}</Button>
        {dueDate && <Button className="mt-auto min-h-11 py-2" disabled={busy} onClick={() => void save(null)} type="button" variant="secondary">{t('caseHistory.clearDate')}</Button>}
      </div>
      {saved && <p aria-live="polite" className="text-sm text-[#326548]" role="status">{t('caseHistory.dateSaved')}</p>}
      {error && <Alert aria-live="polite" role="alert">{t(`errors.${error}`, { defaultValue: t('errors.REQUEST_FAILED') })}</Alert>}
    </Card>
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
    <Card as="section" className="p-4 sm:p-6">
    <form className="space-y-5" onSubmit={(event) => void submit(event)}>
      <div>
        <h2 className="text-lg font-semibold">{t('caseHistory.uploadTitle')}</h2>
        <p className="mt-1 text-sm leading-6 text-[#617166]">{t('caseHistory.uploadInstructions')}</p>
      </div>
      <label className="block text-sm font-medium">
        {t('caseHistory.chooseImage')}
        <input
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          className="mt-2 block min-h-12 w-full cursor-pointer rounded-xl border border-[#d6e2d3] bg-[#fbfcf9] text-sm file:mr-3 file:min-h-12 file:cursor-pointer file:border-0 file:bg-[#EAF4E8] file:px-4 file:font-semibold file:text-[#174D35] focus-visible:ring-2 focus-visible:ring-[#2F855A]"
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
      {image && <p className="truncate rounded-lg bg-[#EAF4E8] px-3 py-2 text-sm text-[#174D35]">{image.name}</p>}
      <label className="block text-sm font-medium">
        {t('caseHistory.observations')}
        <Textarea maxLength={2000} onChange={(event) => setObservations(event.target.value)} placeholder={t('caseHistory.observationsPlaceholder')} value={observations} />
      </label>
      {scans.length > 0 && (
        <label className="block text-sm font-medium">
          {t('caseHistory.previousScan')}
          <Select className="min-h-11" onChange={(event) => setPreviousScanId(event.target.value)} value={previousScanId}>
            {scans.map((scan) => <option key={scan.scanId} value={scan.scanId}>{formatCaseDate(scan.createdAt, i18n.language)} · {scan.scanId.slice(0, 8)}</option>)}
          </Select>
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
      {error && <Alert aria-live="polite" role="alert">{t(`errors.${error}`, { defaultValue: t('errors.REQUEST_FAILED') })}</Alert>}
      <Button className="w-full sm:w-auto" disabled={!image || busy} type="submit">{busy ? t('caseHistory.submitting') : t('caseHistory.submitRecheck')}</Button>
    </form>
    </Card>
  )
}
