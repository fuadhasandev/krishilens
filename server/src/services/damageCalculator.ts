export interface BinaryMask {
  width: number
  height: number
  pixels: Uint8Array
}

export type MeasurementStatus = 'accepted' | 'needs_review' | 'unavailable'

export interface DamageMeasurement {
  leafPixelCount: number | null
  affectedPixelCount: number | null
  percentage: number | null
  status: MeasurementStatus
}

function isValidMask(mask: BinaryMask, width: number, height: number): boolean {
  if (
    mask.width !== width ||
    mask.height !== height ||
    mask.pixels.length !== width * height
  ) {
    return false
  }

  return mask.pixels.every((pixel) => pixel === 0 || pixel === 1)
}

export function unionMasks(
  masks: readonly BinaryMask[],
  width: number,
  height: number,
): Uint8Array | null {
  if (
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width <= 0 ||
    height <= 0 ||
    masks.length === 0 ||
    masks.some((mask) => !isValidMask(mask, width, height))
  ) {
    return null
  }

  const union = new Uint8Array(width * height)
  for (const mask of masks) {
    for (let index = 0; index < union.length; index += 1) {
      union[index] = union[index]! | mask.pixels[index]!
    }
  }

  return union
}

export function calculateAffectedArea(
  width: number,
  height: number,
  leafMasks: readonly BinaryMask[],
  affectedMasks: readonly BinaryMask[],
): DamageMeasurement {
  const unavailable: DamageMeasurement = {
    leafPixelCount: null,
    affectedPixelCount: null,
    percentage: null,
    status: 'unavailable',
  }

  const leaf = unionMasks(leafMasks, width, height)
  if (!leaf) {
    return unavailable
  }

  let leafPixelCount = 0
  for (const pixel of leaf) {
    leafPixelCount += pixel
  }

  if (leafPixelCount === 0) {
    return unavailable
  }

  if (
    affectedMasks.length === 0 ||
    affectedMasks.some((mask) => !isValidMask(mask, width, height))
  ) {
    return {
      ...unavailable,
      leafPixelCount,
      status: affectedMasks.length === 0 ? 'unavailable' : 'needs_review',
    }
  }

  const affected = unionMasks(affectedMasks, width, height)
  if (!affected) {
    return { ...unavailable, leafPixelCount, status: 'needs_review' }
  }

  let affectedPixelCount = 0
  for (let index = 0; index < leaf.length; index += 1) {
    affectedPixelCount += leaf[index]! & affected[index]!
  }

  if (affectedPixelCount === 0) {
    return {
      leafPixelCount,
      affectedPixelCount: null,
      percentage: null,
      status: 'needs_review',
    }
  }

  return {
    leafPixelCount,
    affectedPixelCount,
    percentage: Math.round((affectedPixelCount / leafPixelCount) * 1000) / 10,
    status: 'accepted',
  }
}
