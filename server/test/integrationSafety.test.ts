import assert from 'node:assert/strict'
import test from 'node:test'
import {
  assertDedicatedCloudinaryConfirmation,
  assertDisposableIntegrationDatabase,
} from './helpers/integrationSafety.js'

test('live integration tests reject production and unspecified databases', () => {
  const originalUri = process.env.MONGODB_URI
  try {
    process.env.MONGODB_URI =
      'mongodb://qa:secret@localhost:27017/krishilens_integration_test'
    assert.doesNotThrow(assertDisposableIntegrationDatabase)

    process.env.MONGODB_URI =
      'mongodb://qa:secret@localhost:27017/krishilens_e2e_c3989d3dc2d54968ae22de5d8a9f804c'
    assert.doesNotThrow(assertDisposableIntegrationDatabase)

    process.env.MONGODB_URI = 'mongodb://qa:secret@localhost:27017/krishilens'
    assert.throws(
      assertDisposableIntegrationDatabase,
      /Refusing live integration tests/,
    )
  } finally {
    if (originalUri === undefined) delete process.env.MONGODB_URI
    else process.env.MONGODB_URI = originalUri
  }
})

test('Cloudinary integration requires explicit disposable-account confirmation', () => {
  const original = process.env.E2E_CLOUDINARY_CONFIRMATION
  try {
    delete process.env.E2E_CLOUDINARY_CONFIRMATION
    assert.throws(
      assertDedicatedCloudinaryConfirmation,
      /dedicated disposable account confirmation/,
    )

    process.env.E2E_CLOUDINARY_CONFIRMATION =
      'I_HAVE_CONFIGURED_A_DISPOSABLE_CLOUDINARY_ACCOUNT'
    assert.doesNotThrow(assertDedicatedCloudinaryConfirmation)
  } finally {
    if (original === undefined) delete process.env.E2E_CLOUDINARY_CONFIRMATION
    else process.env.E2E_CLOUDINARY_CONFIRMATION = original
  }
})
