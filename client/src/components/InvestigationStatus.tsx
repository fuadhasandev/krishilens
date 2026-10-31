import type { InvestigationStatus } from '../types/agent'

const statusLabels: Record<InvestigationStatus, string> = {
  investigating: 'Investigating',
  awaiting_farmer: 'Waiting for your answer',
  completed: 'Investigation complete',
  escalated: 'Needs local expert support',
  failed: 'Investigation paused',
}

const statusStyles: Record<InvestigationStatus, string> = {
  investigating: 'bg-[#e9f1e4] text-[#326548]',
  awaiting_farmer: 'bg-[#fff4d8] text-[#755a16]',
  completed: 'bg-[#e9f1e4] text-[#326548]',
  escalated: 'bg-[#fff4d8] text-[#755a16]',
  failed: 'bg-[#fff0ec] text-[#854735]',
}

export function InvestigationStatusBadge({
  status,
}: {
  status: InvestigationStatus
}) {
  return (
    <span
      aria-live="polite"
      className={`inline-flex rounded-full px-3 py-1.5 text-xs font-semibold ${statusStyles[status]}`}
    >
      {statusLabels[status]}
    </span>
  )
}
