import assert from 'node:assert/strict'
import test from 'node:test'
import { fitSegmentResponse } from '../src/services/segmentResponse.js'

test('preserves analysis and authorization while dropping oversized optional output', () => {
  const affectedArea = {
    pixelCount: null,
    percentage: null,
    status: 'unavailable' as const,
  }
  const response = fitSegmentResponse({
    success: true,
    model: 'sam-3.1',
    image: { width: 2048, height: 1536 },
    leaf: { detected: true, pixelCount: 100 },
    affectedArea,
    objects: [{
      id: 'object-1',
      label: 'leaf',
      boundingBox: [0, 0, 1, 1],
    }],
    overlay: { imageUrl: `data:image/png;base64,${'a'.repeat(4 * 1024 * 1024)}` },
    requestIds: ['request-1'],
    scanId: 'scan-id',
    scanAccessToken: 'access-token',
  })

  assert.equal(response.responseTruncated, true)
  assert.equal(response.overlay.imageUrl, null)
  assert.deepEqual(response.affectedArea, affectedArea)
  assert.equal(response.scanId, 'scan-id')
  assert.equal(response.scanAccessToken, 'access-token')
  assert.ok(Buffer.byteLength(JSON.stringify(response)) <= 4 * 1024 * 1024)
})

test('retains the overlay when the response is within the API size limit', () => {
  const response = fitSegmentResponse({
    success: true,
    model: 'sam-3.1',
    image: { width: 10, height: 10 },
    leaf: { detected: false, pixelCount: null },
    affectedArea: { pixelCount: null, percentage: null, status: 'unavailable' },
    objects: [],
    overlay: { imageUrl: 'data:image/png;base64,small' },
    requestIds: [],
    scanId: 'scan-id',
    scanAccessToken: 'access-token',
  })

  assert.equal(response.responseTruncated, undefined)
  assert.equal(response.overlay.imageUrl, 'data:image/png;base64,small')
})
