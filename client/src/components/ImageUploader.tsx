import { ImagePlus, RefreshCw, Trash2 } from 'lucide-react'
import { useState } from 'react'
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
  const [dragging, setDragging] = useState(false)

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
    <div
      className={`rounded-2xl border border-dashed p-4 transition-colors sm:p-5 ${dragging ? 'border-[#2F855A] bg-[#EAF4E8]' : 'border-[#cbd8c4] bg-[#fbfcf9]'}`}
      onDragEnter={(event) => {
        event.preventDefault()
        setDragging(true)
      }}
      onDragLeave={(event) => {
        const nextTarget = event.relatedTarget
        if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) {
          setDragging(false)
        }
      }}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault()
        setDragging(false)
        selectImage(event.dataTransfer.files[0])
      }}
    >
      <div className="flex flex-wrap gap-3">
        <label className="inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border border-[#d6e2d3] bg-white px-4 py-2.5 text-sm font-semibold text-[#174D35] transition-colors hover:bg-[#f1f5ed] focus-within:ring-2 focus-within:ring-[#2F855A]">
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
        <label className="inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border border-[#d6e2d3] bg-white px-4 py-2.5 text-sm font-semibold text-[#174D35] transition-colors hover:bg-[#f1f5ed] focus-within:ring-2 focus-within:ring-[#2F855A]">
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
      <p className="mt-1 text-xs font-medium text-[#2F855A]">
        {t(dragging ? 'imageAnalysis.dropImage' : 'imageAnalysis.dragImage')}
      </p>

      {previewUrl && image && (
        <div className="relative mt-5 overflow-hidden rounded-2xl border border-[#e2e9de] bg-[#f7f8f2]">
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
