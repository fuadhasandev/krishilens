import type { AgentTraceEntry } from '../types/agent'
import { useTranslation } from 'react-i18next'

export function InvestigationTrace({
  trace,
}: {
  trace: AgentTraceEntry[]
}) {
  const { t, i18n } = useTranslation()
  const toolKeys: Record<
    string,
    | 'investigation.toolModel'
    | 'investigation.toolInspect'
    | 'investigation.toolLookup'
    | 'investigation.toolAsk'
    | 'investigation.toolSafety'
    | 'investigation.toolFinalize'
    | 'investigation.toolBudget'
    | 'investigation.toolFailure'
  > = {
    model_turn: 'investigation.toolModel',
    inspect_scan: 'investigation.toolInspect',
    lookup_guidance: 'investigation.toolLookup',
    ask_farmer: 'investigation.toolAsk',
    check_safety: 'investigation.toolSafety',
    finalize_report: 'investigation.toolFinalize',
    execution_budget: 'investigation.toolBudget',
    model_response: 'investigation.toolFailure',
  }

  return (
    <details className="rounded-2xl border border-[#e5ebdf] bg-white p-4">
      <summary className="cursor-pointer font-semibold text-[#315d3d]">
        {t('investigation.traceTitle')}
      </summary>
      <ol className="mt-4 space-y-3">
        {trace.map((entry) => (
          <li className="flex gap-3 text-sm" key={entry.step}>
            <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-[#e9f1e4] text-xs font-semibold text-[#326548]">
              {new Intl.NumberFormat(i18n.resolvedLanguage).format(entry.step)}
            </span>
            <div className="min-w-0">
              <p className="font-medium text-[#31513b]">
                {t(toolKeys[entry.toolName] ?? 'investigation.toolModel')} ·{' '}
                {t(
                  entry.status === 'success'
                    ? 'investigation.traceSuccess'
                    : entry.status === 'failure'
                      ? 'investigation.traceFailure'
                      : 'investigation.traceBlocked',
                )}
              </p>
              <p className="mt-1 text-xs text-[#7b887e]">
                {t('investigation.traceEvent', {
                  step: new Intl.NumberFormat(i18n.resolvedLanguage).format(entry.step),
                })}{' '}
                ·{' '}
                {t('investigation.traceDuration', {
                  duration: new Intl.NumberFormat(i18n.resolvedLanguage).format(entry.durationMs),
                })}
                {entry.evidenceReferenceIds.length > 0
                  ? ` · ${t('investigation.traceEvidence', {
                      count: new Intl.NumberFormat(i18n.resolvedLanguage).format(entry.evidenceReferenceIds.length),
                    })}`
                  : ''}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </details>
  )
}
