import type { ImageAnalysisResponse } from '../types/imageAnalysis'

interface DamageResultProps {
  result: ImageAnalysisResponse
}

const statusLabels = {
  accepted: 'Mask measurement available',
  needs_review: 'Needs visual review',
  unavailable: 'Measurement unavailable',
} as const

export function DamageResult({ result }: DamageResultProps) {
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
            Image segmentation results
          </h2>
          <span className="rounded-full bg-[#e9f1e4] px-3 py-1 text-xs font-medium text-[#326548]">
            {result.model}
          </span>
        </div>
        <p className="mt-1 text-sm text-[#617166]">
          Processed image: {result.image.width} × {result.image.height} pixels
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-[#e5ebdf] bg-[#f7f8f2] p-4">
          <p className="text-sm text-[#617166]">Leaf segmentation</p>
          <p className="mt-1 font-semibold text-[#183b2c]">
            {result.leaf.detected
              ? 'Leaf mask detected'
              : 'No validated leaf mask found'}
          </p>
          {result.leaf.pixelCount !== null && (
            <p className="mt-1 text-sm text-[#617166]">
              {result.leaf.pixelCount.toLocaleString()} mask pixels
            </p>
          )}
        </div>
        <div className="rounded-2xl border border-[#e5ebdf] bg-[#f7f8f2] p-4">
          <p className="text-sm text-[#617166]">Selected candidate region</p>
          <p className="mt-1 font-semibold text-[#183b2c]">
            {statusLabels[result.affectedArea.status]}
          </p>
          {result.affectedArea.percentage !== null ? (
            <>
              <p className="mt-1 text-2xl font-semibold text-[#326548]">
                {result.affectedArea.percentage.toFixed(1)}%
              </p>
              <p className="text-xs text-[#617166]">
                {result.affectedArea.pixelCount?.toLocaleString()} intersecting
                mask pixels
              </p>
            </>
          ) : (
            <p className="mt-1 text-sm text-[#617166]">
              No percentage is shown because the masks were absent or could not be
              validated.
            </p>
          )}
        </div>
      </div>

      {result.warning && (
        <p className="rounded-xl border border-[#eee2bd] bg-[#fffaf0] p-4 text-sm leading-6 text-[#705c2f]">
          {result.warning}
        </p>
      )}

      <p className="text-xs leading-5 text-[#7b887e]">
        Segmentation highlights visual regions only. It does not diagnose a
        disease or establish scientifically validated crop severity. Confirm
        observations with a qualified agricultural officer.
      </p>

      {result.requestIds.length > 0 && (
        <p className="break-all text-xs text-[#7b887e]">
          SAM request IDs: {result.requestIds.join(', ')}
        </p>
      )}
    </section>
  )
}
