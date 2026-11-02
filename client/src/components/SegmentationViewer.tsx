import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface SegmentationViewerProps {
  originalUrl: string
  overlayUrl: string | null
  width: number
  height: number
}

export function SegmentationViewer({
  originalUrl,
  overlayUrl,
  width,
  height,
}: SegmentationViewerProps) {
  const { t } = useTranslation()
  const [overlayVisible, setOverlayVisible] = useState(true)

  return (
    <section aria-label={t('imageAnalysis.comparison')} className="space-y-4">
      {overlayUrl ? (
        <button
          aria-pressed={overlayVisible}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#d6e2d3] bg-white px-4 text-sm font-semibold text-[#174D35] transition-colors hover:bg-[#EAF4E8]"
          onClick={() => setOverlayVisible((visible) => !visible)}
          type="button"
        >
          {overlayVisible ? <EyeOff aria-hidden="true" size={17} /> : <Eye aria-hidden="true" size={17} />}
          {t(overlayVisible ? 'imageAnalysis.hideOverlay' : 'imageAnalysis.showOverlay')}
        </button>
      ) : (
        <p className="rounded-xl border border-[#eee2bd] bg-[#fffaf0] p-3 text-sm leading-6 text-[#705c2f]">
          {t('imageAnalysis.overlayUnavailable')}
        </p>
      )}
      <div className="grid gap-5 sm:grid-cols-2">
      <figure className="min-w-0 rounded-2xl border border-[#e2e9de] bg-[#fbfcf9] p-3 sm:p-4">
        <figcaption className="mb-3 text-sm font-semibold text-[#174D35]">
          {t('imageAnalysis.uploaded')}
        </figcaption>
        <img
          alt={t('imageAnalysis.uploadedAlt')}
          className="block h-auto max-h-[30rem] w-full rounded-xl bg-[#f7f8f2] object-contain"
          src={originalUrl}
        />
      </figure>

      <figure className="min-w-0 rounded-2xl border border-[#e2e9de] bg-[#fbfcf9] p-3 sm:p-4">
        <figcaption className="mb-3 text-sm font-semibold text-[#174D35]">
          {t('imageAnalysis.overlay')}
        </figcaption>
        <div className="relative">
          <img
            alt={t('imageAnalysis.overlayAlt')}
            className="block h-auto max-h-[30rem] w-full rounded-xl bg-[#f7f8f2] object-contain"
            src={originalUrl}
          />
          {overlayUrl && overlayVisible && (
            <img
              alt={t('imageAnalysis.overlayAlt')}
              className="pointer-events-none absolute inset-0 h-full max-h-[30rem] w-full object-contain"
              src={overlayUrl}
              style={{ aspectRatio: `${width} / ${height}` }}
            />
          )}
        </div>
        {overlayVisible && overlayUrl && <p className="mt-3 text-xs leading-5 text-[#7b887e]">
          <span className="font-semibold text-[#2d9a61]">{t('imageAnalysis.green')}</span>{' '}
          {t('imageAnalysis.leafBoundary')} ·{' '}
          <span className="font-semibold text-[#d86b27]">{t('imageAnalysis.orange')}</span>{' '}
          {t('imageAnalysis.candidateRegion')}
        </p>}
      </figure>
      </div>
    </section>
  )
}
