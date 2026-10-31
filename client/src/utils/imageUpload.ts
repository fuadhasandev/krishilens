export const MAX_IMAGE_UPLOAD_BYTES = 4 * 1024 * 1024

const allowedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])

export function isSupportedImageUpload(file: File): boolean {
  return allowedImageTypes.has(file.type) && file.size <= MAX_IMAGE_UPLOAD_BYTES
}
