import type { InvestigationStatus } from '../types/agent'
import { useTranslation } from 'react-i18next'

const statusKeys: Record<
  InvestigationStatus,
  | 'investigation.status.investigating'
  | 'investigation.status.awaitingFarmer'
  | 'investigation.status.completed'
  | 'investigation.status.escalated'
  | 'investigation.status.failed'
> = {
  investigating: 'investigation.status.investigating',
  awaiting_farmer: 'investigation.status.awaitingFarmer',
  completed: 'investigation.status.completed',
  escalated: 'investigation.status.escalated',
  failed: 'investigation.status.failed',
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
  const { t } = useTranslation()

  return (
    <span
      aria-live="polite"
      className={`inline-flex rounded-full px-3 py-1.5 text-xs font-semibold ${statusStyles[status]}`}
    >
      {t(statusKeys[status])}
    </span>
  )
}
