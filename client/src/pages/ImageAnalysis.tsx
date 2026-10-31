import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Image as ImageIcon, LoaderCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { DamageResult } from '../components/DamageResult'
import { ImageUploader } from '../components/ImageUploader'
import { SegmentationViewer } from '../components/SegmentationViewer'
import { analyzeImage } from '../services/imageAnalysis'
import type { Crop } from '../types/cropAnalysis'
import type {
  ImageAnalysisResponse,
  SegmentationTarget,
} from '../types/imageAnalysis'

const crops: { value: Crop; label: string }[] = [
  { value: 'rice', label: 'Rice' },
  { value: 'wheat', label: 'Wheat' },
  { value: 'maize', label: 'Maize' },
  { value: 'jute', label: 'Jute' },
  { value: 'other', label: 'Other' },
]

const targets: { value: SegmentationTarget; label: string }[] = [
  { value: 'brown spots', label: 'Brown spots' },
  { value: 'yellow discolored region', label: 'Yellow discolored region' },
  { value: 'damaged leaf region', label: 'Damaged leaf region' },
]

export function ImageAnalysis() {
  const [image, setImage] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState('')
  const [requestError, setRequestError] = useState('')
  const [crop, setCrop] = useState<Crop>('rice')
  const [target, setTarget] = useState<SegmentationTarget>('brown spots')
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<ImageAnalysisResponse | null>(null)
  const previewRef = useRef<string | null>(null)

  useEffect(() => {
    return () => {
      if (previewRef.current) {
        URL.revokeObjectURL(previewRef.current)
      }
    }
  }, [])

  function handleImageChange(nextImage: File | null, error = '') {
    if (previewRef.current) {
      URL.revokeObjectURL(previewRef.current)
    }
    const nextPreviewUrl = nextImage ? URL.createObjectURL(nextImage) : null
    previewRef.current = nextPreviewUrl
    setPreviewUrl(nextPreviewUrl)
    setImage(nextImage)
    setUploadError(error)
    setRequestError('')
    setResult(null)
  }

  async function handleAnalyze() {
    if (!image) {
      return
    }
    setIsLoading(true)
    setRequestError('')
    setResult(null)

    try {
      setResult(await analyzeImage({ image, crop, target }))
    } catch (error) {
      setRequestError(
        error instanceof Error
          ? error.message
          : 'Image analysis could not be completed. Please try again.',
      )
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f8f2] text-[#183b2c]">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-5 sm:px-8">
        <Link
          aria-label="Back to KrishiLens home"
          className="flex items-center gap-2 text-lg font-bold tracking-tight"
          to="/"
        >
          <ArrowLeft aria-hidden="true" size={20} />
          KrishiLens
        </Link>
        <span className="rounded-full border border-[#dce6d6] bg-white/70 px-3 py-1.5 text-xs font-medium text-[#55705d] sm:text-sm">
          SAM image segmentation
        </span>
      </header>

      <section className="mx-auto w-full max-w-5xl px-5 pb-16 sm:px-8">
        <div className="mb-6">
          <p className="text-sm font-semibold text-[#4c8456]">
            Visual investigation · No disease diagnosis
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
            Segment a crop image
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#617166] sm:text-base">
            Upload or capture a crop image. SAM 3.1 will separately look for the
            crop leaf and the selected visual region. Candidate discoloration is
            not necessarily crop damage or disease.
          </p>
        </div>

        <div className="space-y-6 rounded-3xl border border-[#e5ebdf] bg-white p-5 shadow-sm sm:p-8">
          <ImageUploader
            error={uploadError}
            image={image}
            onImageChange={handleImageChange}
            previewUrl={previewUrl}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium text-[#31513b]">
              Crop
              <select
                className="mt-2 min-h-12 w-full rounded-xl border border-[#dce6d6] bg-[#fbfcf9] px-3 text-base outline-none focus:border-[#4c8456] focus:ring-2 focus:ring-[#4c8456]/20"
                onChange={(event) => setCrop(event.target.value as Crop)}
                value={crop}
              >
                {crops.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm font-medium text-[#31513b]">
              Candidate visual region
              <select
                className="mt-2 min-h-12 w-full rounded-xl border border-[#dce6d6] bg-[#fbfcf9] px-3 text-base outline-none focus:border-[#4c8456] focus:ring-2 focus:ring-[#4c8456]/20"
                onChange={(event) =>
                  setTarget(event.target.value as SegmentationTarget)
                }
                value={target}
              >
                {targets.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <button
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#1f603f] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#194d33] focus:outline-none focus:ring-2 focus:ring-[#4c8456] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:text-base"
            disabled={!image || isLoading}
            onClick={handleAnalyze}
            type="button"
          >
            {isLoading ? (
              <>
                <LoaderCircle
                  aria-hidden="true"
                  className="animate-spin"
                  size={18}
                />
                Segmenting image…
              </>
            ) : (
              <>
                <ImageIcon aria-hidden="true" size={18} />
                Analyze Image
              </>
            )}
          </button>

          {requestError && (
            <p
              aria-live="polite"
              className="rounded-xl border border-[#f1d4cd] bg-[#fff7f4] p-4 text-sm leading-6 text-[#854735]"
              role="alert"
            >
              {requestError}
            </p>
          )}

          {result && (
            <div className="space-y-6 border-t border-[#e5ebdf] pt-6">
              {previewUrl && (
                <SegmentationViewer
                  height={result.image.height}
                  originalUrl={previewUrl}
                  overlayUrl={result.overlay.imageUrl}
                  width={result.image.width}
                />
              )}
              <DamageResult result={result} />
            </div>
          )}
        </div>

        <p className="mt-5 text-center text-sm text-[#7b887e]">
          Want to describe what you’ve seen instead?{' '}
          <Link className="font-semibold text-[#326548] underline" to="/">
            Ask KrishiLens in text
          </Link>
        </p>
      </section>
    </main>
  )
}
