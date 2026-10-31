import type { AgentTraceEntry } from '../types/agent'

export function InvestigationTrace({
  trace,
}: {
  trace: AgentTraceEntry[]
}) {
  return (
    <details className="rounded-2xl border border-[#e5ebdf] bg-white p-4">
      <summary className="cursor-pointer font-semibold text-[#315d3d]">
        View investigation actions
      </summary>
      <ol className="mt-4 space-y-3">
        {trace.map((entry) => (
          <li className="flex gap-3 text-sm" key={entry.step}>
            <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-[#e9f1e4] text-xs font-semibold text-[#326548]">
              {entry.step}
            </span>
            <div className="min-w-0">
              <p className="font-medium text-[#31513b]">{entry.summary}</p>
              <p className="mt-1 text-xs text-[#7b887e]">
                {entry.toolName.replaceAll('_', ' ')} · {entry.durationMs} ms
                {entry.evidenceReferenceIds.length > 0
                  ? ` · ${entry.evidenceReferenceIds.length} evidence reference(s)`
                  : ''}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </details>
  )
}
