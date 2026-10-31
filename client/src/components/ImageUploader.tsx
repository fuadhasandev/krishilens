import { ImagePlus, RefreshCw, Trash2 } from 'lucide-react'

const maxFileSize = 5 * 1024 * 1024
const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])

interface ImageUploaderProps {
  image: File | null
  previewUrl: string | null
  error: string
  onImageChange: (image: File | null, error?: string) => void
}

export function ImageUploader({
  image,
  previewUrl,
  error,
  onImageChange,
}: ImageUploaderProps) {
  function selectImage(file: File | undefined) {
    if (!file) {
      return
    }
    if (!allowedTypes.has(file.type)) {
      onImageChange(null, 'Choose a JPEG, PNG, or WebP image.')
      return
    }
    if (file.size > maxFileSize) {
      onImageChange(null, 'Images must be 5 MB or smaller.')
      return
    }
    onImageChange(file)
  }

  return (
    <div>
      <div className="flex flex-wrap gap-3">
        <label className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-[#dce6d6] bg-white px-4 py-2.5 text-sm font-semibold text-[#315d3d] transition-colors hover:bg-[#f7f8f2]">
          <ImagePlus aria-hidden="true" size={18} />
          {image ? 'Choose another image' : 'Choose an image'}
          <input
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(event) => selectImage(event.currentTarget.files?.[0])}
            type="file"
          />
        </label>
        <label className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-[#dce6d6] bg-white px-4 py-2.5 text-sm font-semibold text-[#315d3d] transition-colors hover:bg-[#f7f8f2]">
          <RefreshCw aria-hidden="true" size={17} />
          Take a photo
          <input
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            className="sr-only"
            onChange={(event) => selectImage(event.currentTarget.files?.[0])}
            type="file"
          />
        </label>
      </div>

      <p className="mt-2 text-xs leading-5 text-[#7b887e]">
        JPEG, PNG, or WebP · Up to 5 MB · Single image only
      </p>

      {previewUrl && image && (
        <div className="relative mt-5 overflow-hidden rounded-2xl border border-[#e5ebdf] bg-[#f7f8f2]">
          <img
            alt={`Preview of ${image.name}`}
            className="mx-auto max-h-[28rem] w-full object-contain"
            src={previewUrl}
          />
          <button
            aria-label="Remove selected image"
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
          {error}
        </p>
      )}
    </div>
  )
}
