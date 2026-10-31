import type { ImageAnalysisResponse } from '../types/imageAnalysis'
import { useTranslation } from 'react-i18next'

interface DamageResultProps {
  result: ImageAnalysisResponse
}

const statusKeys = {
  accepted: 'maskAvailable',
  needs_review: 'needsReview',
  unavailable: 'measurementUnavailable',
} as const

export function DamageResult({ result }: DamageResultProps) {
  const { t, i18n } = useTranslation()
  const number = new Intl.NumberFormat(i18n.resolvedLanguage)

  return (
    <section
      aria-labelledby="segmentation-results-title"
      className="space-y-5"
      id="segmentation-results"
    >
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2
            className="text-xl font-semibold text-[#183b2c]"
            id="segmentation-results-title"
          >
            {t('imageAnalysis.resultTitle')}
          </h2>
          <span className="rounded-full bg-[#e9f1e4] px-3 py-1 text-xs font-medium text-[#326548]">
            {result.model}
          </span>
        </div>
        <p className="mt-1 text-sm text-[#617166]">
          {t('imageAnalysis.processedImage', {
            width: number.format(result.image.width),
            height: number.format(result.image.height),
          })}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-[#e5ebdf] bg-[#f7f8f2] p-4">
          <p className="text-sm text-[#617166]">{t('imageAnalysis.leafSegmentation')}</p>
          <p className="mt-1 font-semibold text-[#183b2c]">
            {result.leaf.detected
              ? t('imageAnalysis.leafDetected')
              : t('imageAnalysis.leafNotDetected')}
          </p>
          {result.leaf.pixelCount !== null && (
            <p className="mt-1 text-sm text-[#617166]">
              {t('imageAnalysis.maskPixels', { count: number.format(result.leaf.pixelCount) })}
            </p>
          )}
        </div>
        <div className="rounded-2xl border border-[#e5ebdf] bg-[#f7f8f2] p-4">
          <p className="text-sm text-[#617166]">{t('imageAnalysis.selectedRegion')}</p>
          <p className="mt-1 font-semibold text-[#183b2c]">
            {t(`imageAnalysis.${statusKeys[result.affectedArea.status]}`)}
          </p>
          {result.affectedArea.percentage !== null ? (
            <>
              <p className="mt-1 text-2xl font-semibold text-[#326548]">
                {new Intl.NumberFormat(i18n.resolvedLanguage, {
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 1,
                }).format(result.affectedArea.percentage)}%
              </p>
              <p className="text-xs text-[#617166]">
                {t('imageAnalysis.intersectingPixels', {
                  count: number.format(result.affectedArea.pixelCount ?? 0),
                })}
              </p>
            </>
          ) : (
            <p className="mt-1 text-sm text-[#617166]">
              {t('imageAnalysis.noPercent')}
            </p>
          )}
        </div>
      </div>

      {result.warning && (
        <p className="rounded-xl border border-[#eee2bd] bg-[#fffaf0] p-4 text-sm leading-6 text-[#705c2f]">
          {t('imageAnalysis.warning')}
        </p>
      )}

      {result.responseTruncated && (
        <p className="rounded-xl border border-[#eee2bd] bg-[#fffaf0] p-4 text-sm leading-6 text-[#705c2f]">
          {t('imageAnalysis.responseSizeNotice')}
        </p>
      )}

      <p className="text-xs leading-5 text-[#7b887e]">
        {t('imageAnalysis.caution')}
      </p>

      {result.requestIds.length > 0 && (
        <p className="break-all text-xs text-[#7b887e]">
          {t('imageAnalysis.samRequestIds', { ids: result.requestIds.join(', ') })}
        </p>
      )}
    </section>
  )
}
