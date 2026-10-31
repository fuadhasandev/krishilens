import assert from 'node:assert/strict'
import test from 'node:test'
import { compareScans, type ComparableScan } from '../src/services/scanComparison.js'

function scan(
  scanId: string,
  affectedPercent: number | null,
  overrides: Partial<ComparableScan> = {},
): ComparableScan {
  return {
    scanId,
    affectedPercent,
    measurementQuality: affectedPercent === null ? 'unavailable' : 'accepted',
    width: 1200,
    height: 900,
    imageQuality: {
      similarLighting: true,
      similarAngle: true,
      samePlantRegion: true,
    },
    ...overrides,
  }
}

test('comparison calculates current minus previous percentage points', () => {
  const result = compareScans(scan('previous', 34.2), scan('current', 21.7))
  assert.equal(result.comparable, true)
  assert.equal(result.percentagePointChange, -12.5)
  assert.equal(result.assessment, 'possible_improvement')
})

test('unavailable values remain null and inconclusive', () => {
  const result = compareScans(scan('previous', null), scan('current', 12))
  assert.equal(result.previousAffectedPercent, null)
  assert.equal(result.percentagePointChange, null)
  assert.equal(result.comparable, false)
  assert.equal(result.assessment, 'inconclusive')
})

test('non-comparable image observations do not imply improvement', () => {
  const result = compareScans(
    scan('previous', 40),
    scan('current', 10, {
      imageQuality: {
        similarLighting: false,
        similarAngle: true,
        samePlantRegion: false,
      },
    }),
  )
  assert.equal(result.percentagePointChange, -30)
  assert.equal(result.comparable, false)
  assert.equal(result.assessment, 'inconclusive')
  assert.ok(result.reasons.includes('similarLighting_not_confirmed'))
})

test('incompatible aspect ratios are inconclusive', () => {
  const result = compareScans(
    scan('previous', 20),
    scan('current', 10, { width: 900, height: 1200 }),
  )
  assert.equal(result.comparable, false)
  assert.equal(result.assessment, 'inconclusive')
  assert.ok(result.reasons.includes('image_dimensions_not_comparable'))
})

test('equal measurements do not imply improvement or worsening', () => {
  const result = compareScans(scan('previous', 15), scan('current', 15))
  assert.equal(result.percentagePointChange, 0)
  assert.equal(result.assessment, 'inconclusive')
})

test('comparison conditions are specific to the selected scan pair', () => {
  const result = compareScans(
    scan('previous', 40, {
      imageQuality: {
        similarLighting: null,
        similarAngle: null,
        samePlantRegion: null,
      },
    }),
    scan('current', 20),
  )
  assert.equal(result.comparable, true)
})
