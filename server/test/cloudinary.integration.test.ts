import assert from 'node:assert/strict'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { once } from 'node:events'
import express from 'express'
import multer from 'multer'
import sharp from 'sharp'
import test from 'node:test'
import {
  AnonymousOwnerModel,
  CaseModel,
  RecheckModel,
  ScanModel,
} from '../src/models/index.js'
import { app } from '../src/app.js'
import { connectDatabase, disconnectDatabase } from '../src/config/database.js'
import { env } from '../src/config/env.js'
import { createRecheckHandler } from '../src/routes/cases.js'
import {
  PrivateImageNotFoundError,
  privateImageStorage,
  type CloudinaryImageReference,
  type PrivateImageReference,
  type PrivateImageStorage,
} from '../src/services/privateImageStorage.js'
import {
  assertDedicatedCloudinaryConfirmation,
  assertDisposableIntegrationDatabase,
} from './helpers/integrationSafety.js'

const enabled = process.env.RUN_CLOUDINARY_INTEGRATION_TESTS === '1'
const testPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l2cAAAAASUVORK5CYII=',
  'base64',
)

test('Cloudinary authenticated image remains private through the authorized case endpoint', {
  skip: !enabled,
}, async () => {
  let stage = 'validating configuration and connecting to MongoDB'
  assertDisposableIntegrationDatabase()
  assertDedicatedCloudinaryConfirmation()
  assert.equal(env.imageStorageProvider, 'cloudinary')
  assert.ok(env.cloudinary.cloudName && env.cloudinary.apiKey && env.cloudinary.apiSecret)
  await connectDatabase()

  const ownerId = randomUUID()
  const otherOwnerId = randomUUID()
  const caseId = randomUUID()
  const scanId = randomUUID()
  const rollbackCaseId = randomUUID()
  const failedSubmissionId = randomUUID()
  const conflictingRecheckId = randomUUID()
  const ownerToken = randomBytes(32).toString('base64url')
  const otherOwnerToken = randomBytes(32).toString('base64url')
  const imageKey = `${ownerId}/${caseId}/${scanId}.png`
  let imageReference: CloudinaryImageReference | undefined
  const rollbackImageReferences: CloudinaryImageReference[] = []
  const server = app.listen(0)
  let recheckServer: ReturnType<typeof app.listen> | undefined

  try {
    stage = 'creating temporary case records'
    await once(server, 'listening')
    const address = server.address()
    assert.ok(address && typeof address !== 'string')

    await Promise.all([
      AnonymousOwnerModel.create({
        ownerId,
        tokenHash: createHash('sha256').update(ownerToken).digest('hex'),
        expiresAt: new Date(Date.now() + 60_000),
      }),
      AnonymousOwnerModel.create({
        ownerId: otherOwnerId,
        tokenHash: createHash('sha256').update(otherOwnerToken).digest('hex'),
        expiresAt: new Date(Date.now() + 60_000),
      }),
      CaseModel.create({
        caseId,
        ownerId,
        crop: 'rice',
        language: 'en',
        status: 'active',
        scanIds: [scanId],
        lastScanAt: new Date(),
        nextRecheckAt: null,
      }),
    ])

    stage = 'uploading an authenticated test image'
    const reference = await privateImageStorage.put(imageKey, testPng, 'image/png')
    if (typeof reference === 'string') {
      throw new Error('Cloudinary provider returned a local image reference.')
    }
    imageReference = reference
    assert.equal(imageReference.deliveryType, 'authenticated')
    assert.equal(imageReference.resourceType, 'image')
    assert.ok(imageReference.publicId && imageReference.assetId)

    await ScanModel.create({
      scanId,
      caseId,
      ownerId,
      imageRef: imageReference,
      image: { width: 1, height: 1 },
      samModel: 'sam-3.1',
      leafDetected: false,
      leafPixelCount: null,
      affectedPixelCount: null,
      affectedPercent: null,
      measurementQuality: 'unavailable',
      imageQuality: {
        similarLighting: null,
        similarAngle: null,
        samePlantRegion: null,
      },
    })

    stage = 'checking unauthenticated public delivery'
    const publicDelivery = await fetch(
      `https://res.cloudinary.com/${env.cloudinary.cloudName}/image/authenticated/${imageReference.publicId}.${imageReference.format}`,
    )
    assert.equal(publicDelivery.ok, false)
    await publicDelivery.body?.cancel()

    const imageUrl = `http://127.0.0.1:${address.port}/api/cases/${caseId}/scans/${scanId}/image`
    stage = 'checking unauthorized case access'
    const unauthorized = await fetch(imageUrl)
    assert.equal(unauthorized.status, 401)
    const wrongOwner = await fetch(imageUrl, {
      headers: { Authorization: `Bearer ${otherOwnerToken}` },
    })
    assert.equal(wrongOwner.status, 404)
    stage = 'retrieving the image through the authorized Express endpoint'
    const authorized = await fetch(imageUrl, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    })
    stage = 'checking the authorized endpoint status'
    assert.equal(authorized.status, 200, 'authorized image endpoint status')
    stage = 'checking the authorized endpoint content type'
    assert.equal(authorized.headers.get('content-type'), 'image/png')
    stage = 'checking the downloaded image bytes'
    const downloadedImage = Buffer.from(await authorized.arrayBuffer())
    const downloadedMetadata = await sharp(downloadedImage).metadata()
    assert.equal(downloadedMetadata.format, 'png')
    assert.equal(downloadedMetadata.width, 1)
    assert.equal(downloadedMetadata.height, 1)

    stage = 'setting up the authenticated re-check upload'
    await CaseModel.create({
      caseId: rollbackCaseId,
      ownerId,
      crop: 'rice',
      language: 'en',
      status: 'active',
      scanIds: [],
      lastScanAt: null,
      nextRecheckAt: null,
    })
    await RecheckModel.init()
    await RecheckModel.create({
      recheckId: conflictingRecheckId,
      submissionId: failedSubmissionId,
      caseId: randomUUID(),
      ownerId: otherOwnerId,
      previousScanId: null,
      currentScanId: randomUUID(),
      intendedDate: null,
      completedAt: new Date(),
      observations: '',
      comparison: null,
      assessment: {
        language: 'en',
        text: 'No prior scan is available.',
        generatedBy: 'fallback',
      },
      status: 'completed',
    })

    const rollbackPng = await sharp({
      create: {
        width: 1,
        height: 1,
        channels: 3,
        background: { r: 24, g: 128, b: 48 },
      },
    }).png().toBuffer()
    const removedRollbackReferences: PrivateImageReference[] = []
    const rollbackStorage: PrivateImageStorage = {
      put: async (key, bytes, contentType) => {
        const stored = await privateImageStorage.put(key, bytes, contentType)
        if (typeof stored === 'string') {
          throw new Error('Cloudinary returned a local image reference.')
        }
        rollbackImageReferences.push(stored)
        return stored
      },
      get: (stored) => privateImageStorage.get(stored),
      remove: async (stored) => {
        removedRollbackReferences.push(stored)
        await privateImageStorage.remove(stored)
      },
    }
    const rollbackApp = express()
    rollbackApp.post(
      '/cases/:caseId/recheck',
      multer({ storage: multer.memoryStorage() }).single('image'),
      createRecheckHandler({
        storage: rollbackStorage,
        segmenter: async (image) => ({
          success: true,
          model: 'sam-3.1',
          image: { width: image.width, height: image.height },
          leaf: { detected: false, pixelCount: null },
          affectedArea: { pixelCount: null, percentage: null, status: 'unavailable' },
          objects: [],
          overlay: { imageUrl: null },
          requestIds: [],
        }),
      }),
    )
    recheckServer = rollbackApp.listen(0)
    await once(recheckServer, 'listening')
    const recheckAddress = recheckServer.address()
    assert.ok(recheckAddress && typeof recheckAddress !== 'string')
    const recheckUrl = `http://127.0.0.1:${recheckAddress.port}/cases/${rollbackCaseId}/recheck`
    stage = 'rejecting an unauthenticated re-check upload'
    const uploadUnauthorized = await fetch(recheckUrl, { method: 'POST' })
    assert.equal(uploadUnauthorized.status, 401)

    const makeUploadForm = () => {
      const form = new FormData()
      form.set('language', 'en')
      form.set('observations', '')
      form.set('image', new Blob([rollbackPng], { type: 'image/png' }), 'rollback.png')
      return form
    }
    stage = 'isolating a re-check upload from another case owner'
    const wrongOwnerUpload = await fetch(recheckUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${otherOwnerToken}`,
        'Idempotency-Key': randomUUID(),
      },
      body: makeUploadForm(),
    })
    assert.equal(wrongOwnerUpload.status, 404)

    stage = 'rolling back an authenticated upload after a database write failure'
    const failedRecheck = await fetch(recheckUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ownerToken}`,
        'Idempotency-Key': failedSubmissionId,
      },
      body: makeUploadForm(),
    })
    assert.equal(failedRecheck.status, 503)
    assert.equal(
      (await failedRecheck.json() as { errorCode: string }).errorCode,
      'PERSISTENCE_FAILED',
    )
    assert.equal(rollbackImageReferences.length, 1)
    assert.deepEqual(removedRollbackReferences, rollbackImageReferences)
    const rolledBackCloudReference = rollbackImageReferences[0]
    assert.ok(rolledBackCloudReference)
    await assert.rejects(
      privateImageStorage.get(rolledBackCloudReference),
      PrivateImageNotFoundError,
    )
    assert.equal(await ScanModel.exists({ caseId: rollbackCaseId, ownerId }), null)

    await new Promise<void>((resolve, reject) => {
      recheckServer?.close((error) => error ? reject(error) : resolve())
    })
    recheckServer = undefined

    stage = 'deleting the Cloudinary test asset'
    await privateImageStorage.remove(imageReference)
    imageReference = undefined
    await assert.rejects(
      privateImageStorage.get({
        provider: 'cloudinary',
        publicId: `krishilens/${ownerId}/${caseId}/${scanId}`,
        assetId: 'deleted-test-asset',
        resourceType: 'image',
        format: 'png',
        deliveryType: 'authenticated',
      }),
      PrivateImageNotFoundError,
    )
  } catch {
    throw new Error(`Cloudinary integration failed during ${stage}.`)
  } finally {
    let cleanupFailed = false
    if (recheckServer) {
      try {
        await new Promise<void>((resolve, reject) => {
          recheckServer?.close((error) => error ? reject(error) : resolve())
        })
      } catch {
        cleanupFailed = true
      }
    }
    try {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve())
      })
    } catch {
      cleanupFailed = true
    }
    if (imageReference) {
      try {
        await privateImageStorage.remove(imageReference)
      } catch {
        cleanupFailed = true
      }
    }
    for (const reference of rollbackImageReferences) {
      try {
        await privateImageStorage.remove(reference)
      } catch {
        cleanupFailed = true
      }
    }
    try {
      await Promise.all([
        ScanModel.deleteOne({ scanId, ownerId }),
        CaseModel.deleteOne({ caseId, ownerId }),
        ScanModel.deleteMany({ caseId: rollbackCaseId, ownerId }),
        CaseModel.deleteOne({ caseId: rollbackCaseId, ownerId }),
        RecheckModel.deleteMany({ caseId: rollbackCaseId, ownerId }),
        RecheckModel.deleteOne({ recheckId: conflictingRecheckId, ownerId: otherOwnerId }),
        AnonymousOwnerModel.deleteMany({ ownerId: { $in: [ownerId, otherOwnerId] } }),
      ])
    } catch {
      cleanupFailed = true
    }
    try {
      await disconnectDatabase()
    } catch {
      cleanupFailed = true
    }
    if (cleanupFailed) {
      throw new Error('Cloudinary integration test cleanup failed.')
    }
  }
})
