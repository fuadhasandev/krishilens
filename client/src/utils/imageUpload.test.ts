import { describe, expect, it } from 'vitest'
import { isSupportedImageUpload, MAX_IMAGE_UPLOAD_BYTES } from './imageUpload'

describe('isSupportedImageUpload', () => {
  it('accepts supported image types at or below 4 MiB', () => {
    expect(isSupportedImageUpload(new File(
      [new Uint8Array(MAX_IMAGE_UPLOAD_BYTES)],
      'crop.png',
      { type: 'image/png' },
    ))).toBe(true)
  })

  it('rejects unsupported types and images above 4 MiB', () => {
    expect(isSupportedImageUpload(new File(['image'], 'crop.gif', {
      type: 'image/gif',
    }))).toBe(false)
    expect(isSupportedImageUpload(new File(
      [new Uint8Array(MAX_IMAGE_UPLOAD_BYTES + 1)],
      'crop.png',
      { type: 'image/png' },
    ))).toBe(false)
  })
})
