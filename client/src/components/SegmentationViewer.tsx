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

  return (
    <section aria-label={t('imageAnalysis.comparison')} className="grid gap-4 sm:grid-cols-2">
      <figure className="min-w-0">
        <figcaption className="mb-2 text-sm font-semibold text-[#31513b]">
          {t('imageAnalysis.uploaded')}
        </figcaption>
        <img
          alt={t('imageAnalysis.uploadedAlt')}
          className="block h-auto max-h-[30rem] w-full rounded-2xl border border-[#e5ebdf] bg-[#f7f8f2] object-contain"
          src={originalUrl}
        />
      </figure>

      <figure className="min-w-0">
        <figcaption className="mb-2 text-sm font-semibold text-[#31513b]">
          {t('imageAnalysis.overlay')}
        </figcaption>
        <div className="relative">
          <img
            alt={t('imageAnalysis.overlayAlt')}
            className="block h-auto max-h-[30rem] w-full rounded-2xl border border-[#e5ebdf] bg-[#f7f8f2] object-contain"
            src={originalUrl}
          />
          {overlayUrl && (
            <img
              alt={t('imageAnalysis.overlayAlt')}
              className="absolute inset-0 h-full max-h-[30rem] w-full object-contain"
              src={overlayUrl}
              style={{ aspectRatio: `${width} / ${height}` }}
            />
          )}
        </div>
        <p className="mt-2 text-xs text-[#7b887e]">
          <span className="font-semibold text-[#2d9a61]">{t('imageAnalysis.green')}</span>{' '}
          {t('imageAnalysis.leafBoundary')} ·{' '}
          <span className="font-semibold text-[#d86b27]">{t('imageAnalysis.orange')}</span>{' '}
          {t('imageAnalysis.candidateRegion')}
        </p>
      </figure>
    </section>
  )
}
