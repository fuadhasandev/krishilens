import { useEffect, useRef, useState } from 'react'
import { BookOpenCheck, Image as ImageIcon, LoaderCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { DamageResult } from '../components/DamageResult'
import { AgentInvestigation } from '../components/AgentInvestigation'
import { ImageUploader } from '../components/ImageUploader'
import { SegmentationViewer } from '../components/SegmentationViewer'
import { Alert, Button, PageHeader, SectionHeader, Select } from '../components/ui'
import { analyzeImage } from '../services/imageAnalysis'
import { currentLanguage } from '../i18n'
import type { Crop } from '../types/cropAnalysis'
import type {
  ImageAnalysisResponse,
  SegmentationTarget,
} from '../types/imageAnalysis'

const crops: Crop[] = ['rice', 'wheat', 'maize', 'jute', 'other']

const targets: {
  value: SegmentationTarget
  labelKey:
    | 'imageAnalysis.brownSpots'
    | 'imageAnalysis.yellowRegion'
    | 'imageAnalysis.damagedRegion'
}[] = [
  { value: 'brown spots', labelKey: 'imageAnalysis.brownSpots' },
  { value: 'yellow discolored region', labelKey: 'imageAnalysis.yellowRegion' },
  { value: 'damaged leaf region', labelKey: 'imageAnalysis.damagedRegion' },
]

export function ImageAnalysis() {
  const { t } = useTranslation()
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

  function handleImageChange(nextImage: File | null, errorCode = '') {
    if (previewRef.current) {
      URL.revokeObjectURL(previewRef.current)
    }
    const nextPreviewUrl = nextImage ? URL.createObjectURL(nextImage) : null
    previewRef.current = nextPreviewUrl
    setPreviewUrl(nextPreviewUrl)
    setImage(nextImage)
    setUploadError(errorCode)
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
      setResult(await analyzeImage({ image, crop, target, language: currentLanguage() }))
    } catch (error) {
      const code = error instanceof Error ? error.message : 'UPLOAD_FAILED'
      setRequestError(code)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#FAF9F5] text-[#173c2c]">
      <PageHeader backTo="/" backLabel={t('navigation.backHome')}>
        <Link aria-label={t('caseHistory.title')} title={t('caseHistory.title')} className="inline-flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-[#326548] hover:bg-[#EAF4E8] hover:text-[#183b2c]" to="/cases">
            <BookOpenCheck aria-hidden="true" size={18} />
            <span className="hidden sm:inline">
            {t('caseHistory.title')}
            </span>
        </Link>
      </PageHeader>

      <section className="mx-auto w-full max-w-6xl px-5 pb-16 pt-3 sm:px-8 sm:pb-20">
        <SectionHeader
          className="mb-7"
          eyebrow={t('imageAnalysis.eyebrow')}
          title={t('imageAnalysis.title')}
          description={t('imageAnalysis.intro')}
          headingLevel={1}
        />

        <div className="space-y-6 rounded-3xl border border-[#e2e9de] bg-white p-4 shadow-[0_12px_36px_rgba(23,77,53,0.06)] sm:p-7 lg:p-8">
          <ImageUploader
            error={uploadError}
            image={image}
            onImageChange={handleImageChange}
            previewUrl={previewUrl}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium text-[#31513b]">
              {t('common.crop')}
              <Select
                onChange={(event) => setCrop(event.target.value as Crop)}
                value={crop}
              >
                {crops.map((value) => (
                  <option key={value} value={value}>
                    {t(`common.${value}`)}
                  </option>
                ))}
              </Select>
            </label>

            <label className="block text-sm font-medium text-[#31513b]">
              {t('imageAnalysis.target')}
              <Select
                onChange={(event) =>
                  setTarget(event.target.value as SegmentationTarget)
                }
                value={target}
              >
                {targets.map((item) => (
                  <option key={item.value} value={item.value}>
                    {t(item.labelKey)}
                  </option>
                ))}
              </Select>
            </label>
          </div>

          <Button
            className="w-full sm:w-auto sm:text-base"
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
                {t('imageAnalysis.segmenting')}
              </>
            ) : (
              <>
                <ImageIcon aria-hidden="true" size={18} />
                {t('imageAnalysis.analyze')}
              </>
            )}
          </Button>

          {requestError && (
            <Alert
              aria-live="polite"
              role="alert"
            >
              {t(`errors.${requestError}`, { defaultValue: t('errors.UPLOAD_FAILED') })}
            </Alert>
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
              <AgentInvestigation
                crop={crop}
                key={result.scanId}
                scanAccessToken={result.scanAccessToken}
                scanId={result.scanId}
              />
            </div>
          )}
        </div>

        <p className="mt-5 text-center text-sm text-[#7b887e]">
          {t('imageAnalysis.describeInstead')}{' '}
          <Link className="font-semibold text-[#326548] underline" to="/">
            {t('imageAnalysis.askText')}
          </Link>
        </p>
      </section>
    </main>
  )
}
