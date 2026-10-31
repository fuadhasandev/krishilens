import { ImagePlus, RefreshCw, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { isSupportedImageUpload } from '../utils/imageUpload'

interface ImageUploaderProps {
  image: File | null
  previewUrl: string | null
  error: string
  onImageChange: (image: File | null, errorCode?: string) => void
}

export function ImageUploader({
  image,
  previewUrl,
  error,
  onImageChange,
}: ImageUploaderProps) {
  const { t } = useTranslation()

  function selectImage(file: File | undefined) {
    if (!file) {
      return
    }
    if (!isSupportedImageUpload(file)) {
      onImageChange(null, 'INVALID_IMAGE')
      return
    }
    onImageChange(file)
  }

  return (
    <div>
      <div className="flex flex-wrap gap-3">
        <label className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-[#dce6d6] bg-white px-4 py-2.5 text-sm font-semibold text-[#315d3d] transition-colors hover:bg-[#f7f8f2]">
          <ImagePlus aria-hidden="true" size={18} />
          {image ? t('imageAnalysis.chooseAnother') : t('imageAnalysis.chooseImage')}
          <input
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0]
              if (file && !isSupportedImageUpload(file)) {
                event.currentTarget.value = ''
              }
              selectImage(file)
            }}
            type="file"
          />
        </label>
        <label className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-[#dce6d6] bg-white px-4 py-2.5 text-sm font-semibold text-[#315d3d] transition-colors hover:bg-[#f7f8f2]">
          <RefreshCw aria-hidden="true" size={17} />
          {t('imageAnalysis.takePhoto')}
          <input
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            className="sr-only"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0]
              if (file && !isSupportedImageUpload(file)) {
                event.currentTarget.value = ''
              }
              selectImage(file)
            }}
            type="file"
          />
        </label>
      </div>

      <p className="mt-2 text-xs leading-5 text-[#7b887e]">
        {t('imageAnalysis.fileRules')}
      </p>

      {previewUrl && image && (
        <div className="relative mt-5 overflow-hidden rounded-2xl border border-[#e5ebdf] bg-[#f7f8f2]">
          <img
            alt={t('imageAnalysis.preview', { name: image.name })}
            className="mx-auto max-h-[28rem] w-full object-contain"
            src={previewUrl}
          />
          <button
            aria-label={t('imageAnalysis.removeImage')}
            className="absolute right-3 top-3 inline-flex size-10 items-center justify-center rounded-full bg-white/95 text-[#854735] shadow-sm hover:bg-white focus:outline-none focus:ring-2 focus:ring-[#854735]"
            onClick={() => onImageChange(null)}
            type="button"
          >
            <Trash2 aria-hidden="true" size={18} />
          </button>
          <p className="truncate border-t border-[#e5ebdf] px-4 py-2 text-xs text-[#617166]">
            {image.name}
          </p>
        </div>
      )}

      {error && (
        <p aria-live="polite" className="mt-3 text-sm text-[#9b4935]" role="alert">
          {t(`errors.${error}`, { defaultValue: t('errors.INVALID_IMAGE') })}
        </p>
      )}
    </div>
  )
}
