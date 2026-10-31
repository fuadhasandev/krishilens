import type { InvestigationReport as InvestigationReportData } from '../types/agent'
import { useTranslation } from 'react-i18next'
import { EvidenceSources } from './EvidenceSources'

const evidenceKeys = {
  supported: 'supported',
  tentative: 'tentative',
  insufficient_evidence: 'insufficient',
} as const

export function InvestigationReport({
  report,
}: {
  report: InvestigationReportData
}) {
  const { t, i18n } = useTranslation()
  const measurement = report.segmentationMeasurementQuality
  const percentage = measurement.percentage === null
    ? ''
    : new Intl.NumberFormat(i18n.resolvedLanguage, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }).format(measurement.percentage)

  return (
    <article
      aria-live="polite"
      className="space-y-6 rounded-2xl border border-[#dce6d6] bg-[#f7f8f2] p-5 sm:p-6"
    >
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-[#4c8456]">
          {t('reports.title')}
        </p>
        <h3 className="mt-1 text-xl font-semibold text-[#183b2c]">
          {t('reports.subtitle')}
        </h3>
        <p className="mt-3 text-sm leading-7 text-[#46564a]">{report.summary}</p>
      </header>

      <section>
        <h4 className="font-semibold text-[#183b2c]">
          {t('reports.observations')}
        </h4>
        <ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-6 text-[#46564a]">
          {report.visibleObservations.map((observation) => (
            <li key={observation.id}>{observation.description}</li>
          ))}
        </ul>
      </section>

      <section>
        <h4 className="font-semibold text-[#183b2c]">
          {t('reports.causes')}
        </h4>
        {report.possibleCauses.length === 0 ? (
          <p className="mt-2 text-sm leading-6 text-[#617166]">
            {t('reports.noCauses')}
          </p>
        ) : (
          <ul className="mt-3 space-y-4">
            {report.possibleCauses.map((cause, index) => (
              <li className="rounded-xl border border-[#e5ebdf] bg-white p-4" key={`${cause.cause}-${index}`}>
                <p className="font-medium text-[#31513b]">{cause.cause}</p>
                <span className="mt-2 inline-flex rounded-full bg-[#eef2e9] px-2.5 py-1 text-xs text-[#55705d]">
                  {t(`reports.${evidenceKeys[cause.evidenceLevel]}`)}
                </span>
                {cause.supportingEvidence.length > 0 && (
                  <ul className="mt-3 space-y-2 text-sm leading-6 text-[#617166]">
                    {cause.supportingEvidence.map((evidence) => (
                      <li key={`${evidence.type}-${evidence.referenceId}`}>
                        <span className="font-semibold">
                          {t(evidence.type === 'observation' ? 'reports.evidenceObservation' : 'reports.evidenceSource')}:{' '}
                        </span>
                        {evidence.description}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {report.missingInformation.length > 0 && (
        <section>
          <h4 className="font-semibold text-[#183b2c]">
            {t('reports.missing')}
          </h4>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-[#46564a]">
            {report.missingInformation.map((item, index) => (
              <li key={`${index}-${item}`}>{item}</li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h4 className="font-semibold text-[#183b2c]">
          {t('reports.nextSteps')}
        </h4>
        <ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-6 text-[#46564a]">
          {report.safeNextSteps.map((step, index) => (
            <li key={`${index}-${step}`}>{step}</li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-[#e5ebdf] bg-white p-4">
        <h4 className="font-semibold text-[#183b2c]">
          {t('reports.measurementQuality')}
        </h4>
        <p className="mt-2 text-sm leading-6 text-[#617166]">
          {measurement.status === 'accepted' && measurement.percentage !== null
            ? t('reports.measurementAccepted', { percentage })
            : t('reports.measurementMissing')}
        </p>
      </section>

      <EvidenceSources citations={report.citations} />

      {report.escalationRecommendation.recommended && (
        <p className="rounded-xl border border-[#f1dfaa] bg-[#fff9e9] p-4 text-sm leading-6 text-[#755a16]">
          {t('reports.escalation', { reason: report.escalationRecommendation.reason })}
        </p>
      )}
    </article>
  )
}
