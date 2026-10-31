import type { InvestigationReport } from '../types/agent'

export function EvidenceSources({
  citations,
  language,
}: {
  citations: InvestigationReport['citations']
  language: 'bn' | 'en'
}) {
  return (
    <section>
      <h3 className="font-semibold text-[#183b2c]">
        {language === 'bn' ? 'ব্যবহৃত সূত্র' : 'Retrieved sources'}
      </h3>
      {citations.length === 0 ? (
        <p className="mt-2 text-sm leading-6 text-[#617166]">
          {language === 'bn'
            ? 'এই তদন্তে উপসর্গ-নির্দিষ্ট কোনো নির্ভরযোগ্য সূত্র পাওয়া যায়নি।'
            : 'No symptom-specific agricultural source was retrieved for this investigation.'}
        </p>
      ) : (
        <ul className="mt-2 space-y-2">
          {citations.map((citation) => (
            <li key={citation.sourceId}>
              <a
                className="break-words text-sm font-medium text-[#326548] underline decoration-[#9ab59c] underline-offset-2 hover:text-[#183b2c]"
                href={citation.url}
                rel="noreferrer"
                target="_blank"
              >
                {citation.title}
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
