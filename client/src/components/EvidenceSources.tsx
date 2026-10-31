import type { InvestigationReport } from '../types/agent'
import { useTranslation } from 'react-i18next'

export function EvidenceSources({
  citations,
}: {
  citations: InvestigationReport['citations']
}) {
  const { t } = useTranslation()

  return (
    <section>
      <h3 className="font-semibold text-[#183b2c]">{t('reports.sources')}</h3>
      {citations.length === 0 ? (
        <p className="mt-2 text-sm leading-6 text-[#617166]">
          {t('reports.noSources')}
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
