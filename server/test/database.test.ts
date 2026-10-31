import assert from 'node:assert/strict'
import test from 'node:test'
import { connectDatabase } from '../src/config/database.js'
import { RecheckModel } from '../src/models/index.js'

test('database connection reports missing MongoDB configuration without connecting', async () => {
  await assert.rejects(
    connectDatabase(''),
    /MongoDB is not configured\. Set MONGODB_URI/,
  )
})

test('a first re-check can persist without a previous comparison', async () => {
  const record = new RecheckModel({
    recheckId: '123e4567-e89b-42d3-a456-426614174000',
    submissionId: '123e4567-e89b-42d3-a456-426614174001',
    caseId: '123e4567-e89b-42d3-a456-426614174002',
    ownerId: '123e4567-e89b-42d3-a456-426614174003',
    previousScanId: null,
    currentScanId: '123e4567-e89b-42d3-a456-426614174004',
    intendedDate: null,
    completedAt: new Date(),
    observations: '',
    comparison: null,
    assessment: {
      language: 'en',
      text: 'There is no earlier scan available for comparison.',
      generatedBy: 'fallback',
    },
    status: 'completed',
  })

  await assert.doesNotReject(record.validate())
  assert.equal(record.comparison, null)
})
