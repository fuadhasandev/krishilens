import type { InvestigationReport as InvestigationReportData } from '../types/agent'
import { EvidenceSources } from './EvidenceSources'

const evidenceLabels = {
  supported: 'Evidence-supported observation',
  tentative: 'Tentative possibility',
  insufficient_evidence: 'Insufficient evidence',
} as const

export function InvestigationReport({
  report,
}: {
  report: InvestigationReportData
}) {
  const isBangla = report.language === 'bn'
  const measurement = report.segmentationMeasurementQuality

  return (
    <article
      aria-live="polite"
      className="space-y-6 rounded-2xl border border-[#dce6d6] bg-[#f7f8f2] p-5 sm:p-6"
    >
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-[#4c8456]">
          {isBangla ? 'তদন্তের প্রতিবেদন' : 'Investigation report'}
        </p>
        <h3 className="mt-1 text-xl font-semibold text-[#183b2c]">
          {isBangla ? 'আপনার ফসলের পর্যবেক্ষণ' : 'Your crop investigation'}
        </h3>
        <p className="mt-3 text-sm leading-7 text-[#46564a]">{report.summary}</p>
      </header>

      <section>
        <h4 className="font-semibold text-[#183b2c]">
          {isBangla ? 'দৃশ্যমান পর্যবেক্ষণ' : 'Visible observations'}
        </h4>
        <ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-6 text-[#46564a]">
          {report.visibleObservations.map((observation) => (
            <li key={observation.id}>{observation.description}</li>
          ))}
        </ul>
      </section>

      <section>
        <h4 className="font-semibold text-[#183b2c]">
          {isBangla ? 'সম্ভাব্য কারণ — রোগ নির্ণয় নয়' : 'Possible causes — not a diagnosis'}
        </h4>
        {report.possibleCauses.length === 0 ? (
          <p className="mt-2 text-sm leading-6 text-[#617166]">
            {isBangla
              ? 'বর্তমান তথ্য থেকে সম্ভাব্য কারণ নির্ভরযোগ্যভাবে আলাদা করা যাচ্ছে না।'
              : 'Available information does not reliably distinguish possible causes.'}
          </p>
        ) : (
          <ul className="mt-3 space-y-4">
            {report.possibleCauses.map((cause, index) => (
              <li className="rounded-xl border border-[#e5ebdf] bg-white p-4" key={`${cause.cause}-${index}`}>
                <p className="font-medium text-[#31513b]">{cause.cause}</p>
                <span className="mt-2 inline-flex rounded-full bg-[#eef2e9] px-2.5 py-1 text-xs text-[#55705d]">
                  {evidenceLabels[cause.evidenceLevel]}
                </span>
                {cause.supportingEvidence.length > 0 && (
                  <ul className="mt-3 space-y-2 text-sm leading-6 text-[#617166]">
                    {cause.supportingEvidence.map((evidence) => (
                      <li key={`${evidence.type}-${evidence.referenceId}`}>
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
            {isBangla ? 'যে তথ্যগুলো এখনও প্রয়োজন' : 'Information still needed'}
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
          {isBangla ? 'নিরাপদ পরবর্তী পদক্ষেপ' : 'Safe next steps'}
        </h4>
        <ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-6 text-[#46564a]">
          {report.safeNextSteps.map((step, index) => (
            <li key={`${index}-${step}`}>{step}</li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-[#e5ebdf] bg-white p-4">
        <h4 className="font-semibold text-[#183b2c]">
          {isBangla ? 'ছবির পরিমাপের মান' : 'Image measurement quality'}
        </h4>
        <p className="mt-2 text-sm leading-6 text-[#617166]">
          {measurement.status === 'accepted' && measurement.percentage !== null
            ? isBangla
              ? `সেগমেন্ট করা প্রার্থী অঞ্চল পাতার মুখোশের ${measurement.percentage}% এর সঙ্গে মিলে। এটি রোগের তীব্রতা নয়।`
              : `The segmented candidate region overlaps ${measurement.percentage}% of the leaf mask. This is not disease severity.`
            : isBangla
              ? 'ক্ষতিগ্রস্ত এলাকার পরিমাপ পাওয়া যায়নি; শূন্য ক্ষতি ধরে নেওয়া হয়নি।'
              : 'No affected-area estimate is available; this is not interpreted as zero damage.'}
        </p>
      </section>

      <EvidenceSources citations={report.citations} language={report.language} />

      {report.escalationRecommendation.recommended && (
        <p className="rounded-xl border border-[#f1dfaa] bg-[#fff9e9] p-4 text-sm leading-6 text-[#755a16]">
          {isBangla
            ? `স্থানীয় কৃষি কর্মকর্তার পরামর্শ নিন: ${report.escalationRecommendation.reason}`
            : `Consult a qualified local agricultural officer: ${report.escalationRecommendation.reason}`}
        </p>
      )}
    </article>
  )
}
