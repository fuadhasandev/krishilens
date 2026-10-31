import assert from 'node:assert/strict'
import test from 'node:test'
import {
  calculateAffectedArea,
  unionMasks,
  type BinaryMask,
} from '../src/services/damageCalculator.js'

function mask(width: number, pixels: number[]): BinaryMask {
  return {
    width,
    height: 1,
    pixels: Uint8Array.from(pixels),
  }
}

test('intersects masks and does not double-count overlapping masks', () => {
  const leaf = mask(8, [1, 1, 1, 1, 0, 0, 0, 0])
  const overlappingLeaf = mask(8, [0, 1, 0, 0, 0, 0, 0, 0])
  const affected = mask(8, [1, 0, 1, 1, 0, 0, 0, 0])
  const overlappingAffected = mask(8, [0, 1, 1, 0, 1, 0, 0, 0])

  const result = calculateAffectedArea(
    8,
    1,
    [leaf, overlappingLeaf],
    [affected, overlappingAffected],
  )

  assert.deepEqual(result, {
    leafPixelCount: 4,
    affectedPixelCount: 4,
    percentage: 100,
    status: 'accepted',
  })
})

test('rounds percentages to one decimal place', () => {
  const leaf = mask(6, [1, 1, 1, 1, 1, 1])
  const affected = mask(6, [1, 0, 0, 0, 0, 0])

  assert.equal(
    calculateAffectedArea(6, 1, [leaf], [affected]).percentage,
    16.7,
  )
})

test('returns unavailable when there is no leaf mask or no leaf pixels', () => {
  const empty = mask(4, [0, 0, 0, 0])

  assert.equal(calculateAffectedArea(4, 1, [], [empty]).status, 'unavailable')
  assert.deepEqual(calculateAffectedArea(4, 1, [empty], [empty]), {
    leafPixelCount: null,
    affectedPixelCount: null,
    percentage: null,
    status: 'unavailable',
  })
})

test('returns unavailable for dimensionally invalid leaf masks', () => {
  const invalid = mask(3, [1, 1, 1])

  assert.equal(unionMasks([invalid], 4, 1), null)
  assert.equal(
    calculateAffectedArea(4, 1, [invalid], [mask(4, [1, 0, 0, 0])]).status,
    'unavailable',
  )
})

test('returns needs_review and no percentage for invalid affected masks', () => {
  const leaf = mask(4, [1, 1, 1, 1])
  const invalid = mask(3, [1, 0, 0])

  assert.deepEqual(calculateAffectedArea(4, 1, [leaf], [invalid]), {
    leafPixelCount: 4,
    affectedPixelCount: null,
    percentage: null,
    status: 'needs_review',
  })
})

test('a valid but disjoint affected mask is unavailable for review', () => {
  const leaf = mask(4, [1, 1, 1, 1])
  const affected = mask(4, [0, 0, 0, 0])

  assert.deepEqual(calculateAffectedArea(4, 1, [leaf], [affected]), {
    leafPixelCount: 4,
    affectedPixelCount: null,
    percentage: null,
    status: 'needs_review',
  })
})

test('a candidate mask entirely outside the leaf is not zero damage', () => {
  const leaf = mask(4, [1, 1, 0, 0])
  const candidate = mask(4, [0, 0, 1, 1])

  assert.deepEqual(calculateAffectedArea(4, 1, [leaf], [candidate]), {
    leafPixelCount: 2,
    affectedPixelCount: null,
    percentage: null,
    status: 'needs_review',
  })
})
