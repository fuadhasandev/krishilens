import assert from 'node:assert/strict'
import test from 'node:test'
import {
  connectDatabase,
  summarizeMongoError,
} from '../src/config/database.js'
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

  test('MongoDB diagnostics classify nested DNS errors without exposing messages', () => {
    const result = summarizeMongoError({
      name: 'MongooseServerSelectionError',
      message: 'sensitive connection details should not appear',
      reason: {
        servers: new Map([
          [
            'private-host.example:27017',
            {
              name: 'MongoNetworkError',
              message: 'getaddrinfo ENOTFOUND private-host.example',
              code: 'ENOTFOUND',
            },
          ],
        ]),
      },
    })

    assert.equal(result.category, 'dns')
    assert.ok(result.nestedErrors.some((entry) => entry.code === 'ENOTFOUND'))
    assert.equal(JSON.stringify(result).includes('private-host'), false)
    assert.equal(JSON.stringify(result).includes('sensitive connection details'), false)
  })

  test('MongoDB diagnostics distinguish authentication, TLS, timeout, and URI failures', () => {
    assert.equal(
      summarizeMongoError({
        name: 'MongoServerError',
        message: 'Authentication failed',
        code: 18,
      }).category,
      'authentication',
    )
    assert.equal(
      summarizeMongoError({
        name: 'MongoNetworkError',
        message: 'TLS certificate verification failed',
        code: 'CERT_HAS_EXPIRED',
      }).category,
      'tls',
    )
    assert.equal(
      summarizeMongoError({
        name: 'MongooseServerSelectionError',
        message: 'Server selection timed out',
      }).category,
      'timeout_or_firewall_allowlist',
    )
    assert.equal(
      summarizeMongoError({
        name: 'MongoParseError',
        message: 'Invalid connection string with credential details',
      }).category,
      'connection_string',
    )
  })

  await assert.doesNotReject(record.validate())
  assert.equal(record.comparison, null)
})
