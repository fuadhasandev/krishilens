import assert from 'node:assert/strict'
import { spawn, type ChildProcess } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { once } from 'node:events'
import { createServer } from 'node:net'
import { setTimeout as delay } from 'node:timers/promises'
import test from 'node:test'
import express from 'express'
import mongoose from 'mongoose'
import multer from 'multer'
import sharp from 'sharp'
import { app } from '../src/app.js'
import { createRecheckHandler } from '../src/routes/cases.js'
import { connectDatabase, disconnectDatabase } from '../src/config/database.js'
import { useMongoScanStore, MongoScanStore } from '../src/agent/scanStore.js'
import {
  MongoSessionStore,
  SessionConflictError,
  useMongoSessionStore,
} from '../src/agent/sessionStore.js'
import {
  AgentScanModel,
  AnonymousOwnerModel,
  CaseModel,
  InvestigationModel,
  RecheckModel,
  ScanModel,
  TraceModel,
} from '../src/models/index.js'
import { assertDisposableIntegrationDatabase } from './helpers/integrationSafety.js'
import {
  privateImageStorage,
  type PrivateImageReference,
  type PrivateImageStorage,
} from '../src/services/privateImageStorage.js'
import type { SamAnalysis } from '../src/services/sam.js'

import '../src/config/env.js'

const enabled = process.env.RUN_MONGODB_INTEGRATION_TESTS === '1'

async function availablePort(): Promise<number> {
  const listener = createServer()
  listener.listen(0, '127.0.0.1')
  await once(listener, 'listening')
  const address = listener.address()
  assert.ok(address && typeof address !== 'string')
  await new Promise<void>((resolve, reject) => {
    listener.close((error) => error ? reject(error) : resolve())
  })
  return address.port
}

async function startApiProcess(): Promise<{ child: ChildProcess; baseUrl: string }> {
  const port = await availablePort()
  const child = spawn(
    process.execPath,
    ['--import', 'tsx', 'src/dev.ts'],
    {
      cwd: process.cwd(),
      env: { ...process.env, PORT: String(port) },
      stdio: 'ignore',
    },
  )

  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (child.exitCode !== null) {
      throw new Error(`KrishiLens API child exited during startup (${child.exitCode}).`)
    }
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/health`, {
        signal: AbortSignal.timeout(1000),
      })
      if (response.ok) {
        return { child, baseUrl: `http://127.0.0.1:${port}` }
      }
    } catch {
      await delay(500)
    }
  }
  child.kill('SIGTERM')
  throw new Error('KrishiLens API child did not become ready after MongoDB startup.')
}

async function stopApiProcess(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null) return
  const exited = once(child, 'exit')
  child.kill('SIGTERM')
  await Promise.race([exited, delay(3000)])
  if (child.exitCode === null) child.kill('SIGKILL')
}

test('MongoDB persists case, scan image, re-check, and awaiting agent state across process restarts', {
  skip: !enabled,
}, async () => {
  assertDisposableIntegrationDatabase()
  await connectDatabase()
  useMongoScanStore()
  useMongoSessionStore()

  const instance = app.listen(0)
  await once(instance, 'listening')
  const address = instance.address()
  assert.ok(address && typeof address !== 'string')

  const cleanupIds = {
    caseIds: [] as string[],
    scanIds: [] as string[],
    recheckIds: [] as string[],
    ownerIds: [] as string[],
    agentScanIds: [] as string[],
    investigationIds: [] as string[],
  }
  const imageRefs: PrivateImageReference[] = []
  let server = instance
  let apiProcess: ChildProcess | undefined

  try {
    const createdResponse = await fetch(`http://127.0.0.1:${address.port}/api/cases`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ crop: 'rice', language: 'en' }),
    })
    assert.equal(createdResponse.status, 201)
    const createdBody = await createdResponse.json() as {
      case: { caseId: string }
      ownerAccessToken: string
    }
    const ownerToken = createdBody.ownerAccessToken
    const caseId = createdBody.case.caseId
    cleanupIds.caseIds.push(caseId)
    const owner = await AnonymousOwnerModel.findOne({
      tokenHash: createHash('sha256').update(ownerToken).digest('hex'),
    }).lean()
    assert.ok(owner)
    cleanupIds.ownerIds.push(owner.ownerId)

    const otherOwnerResponse = await fetch(`http://127.0.0.1:${address.port}/api/cases`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ crop: 'rice', language: 'en' }),
    })
    assert.equal(otherOwnerResponse.status, 201)
    const otherOwnerBody = await otherOwnerResponse.json() as {
      case: { caseId: string }
      ownerAccessToken: string
    }
    cleanupIds.caseIds.push(otherOwnerBody.case.caseId)
    const otherOwner = await AnonymousOwnerModel.findOne({
      tokenHash: createHash('sha256').update(otherOwnerBody.ownerAccessToken).digest('hex'),
    }).lean()
    assert.ok(otherOwner)
    cleanupIds.ownerIds.push(otherOwner.ownerId)

    const unauthorized = await fetch(`http://127.0.0.1:${address.port}/api/cases/${caseId}`)
    assert.equal(unauthorized.status, 401)
    const wrongOwner = await fetch(`http://127.0.0.1:${address.port}/api/cases/${caseId}`, {
      headers: { Authorization: `Bearer ${otherOwnerBody.ownerAccessToken}` },
    })
    assert.equal(wrongOwner.status, 404)
    const caseResponse = await fetch(`http://127.0.0.1:${address.port}/api/cases/${caseId}`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    })
    assert.equal(caseResponse.status, 200)

    const unauthenticatedRecheck = await fetch(
      `http://127.0.0.1:${address.port}/api/cases/${caseId}/recheck`,
      { method: 'POST' },
    )
    assert.equal(unauthenticatedRecheck.status, 401)
    const authenticatedRecheckWithoutImage = await fetch(
      `http://127.0.0.1:${address.port}/api/cases/${caseId}/recheck`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${ownerToken}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': randomUUID(),
        },
        body: JSON.stringify({ language: 'en' }),
      },
    )
    assert.equal(authenticatedRecheckWithoutImage.status, 400)

    const scanId = randomUUID()
    const imageBytes = Buffer.from('protected test image fixture')
    const imageKey = `${owner.ownerId}/${caseId}/${scanId}.jpg`
    const imageRef = await privateImageStorage.put(imageKey, imageBytes)
    imageRefs.push(imageRef)
    await ScanModel.create({
      scanId,
      caseId,
      ownerId: owner.ownerId,
      imageRef,
      image: { width: 1200, height: 900 },
      samModel: 'sam-3.1',
      leafDetected: true,
      leafPixelCount: 400,
      affectedPixelCount: null,
      affectedPercent: null,
      measurementQuality: 'unavailable',
      imageQuality: {
        similarLighting: null,
        similarAngle: null,
        samePlantRegion: null,
      },
    })
    cleanupIds.scanIds.push(scanId)
    await CaseModel.updateOne(
      { caseId, ownerId: owner.ownerId },
      { $addToSet: { scanIds: scanId }, $set: { lastScanAt: new Date() } },
    )
    const scanHistory = await fetch(
      `http://127.0.0.1:${address.port}/api/cases/${caseId}/scans`,
      { headers: { Authorization: `Bearer ${ownerToken}` } },
    )
    assert.equal(scanHistory.status, 200)
    assert.equal((await scanHistory.json() as { scans: unknown[] }).scans.length, 1)
    const imageResponse = await fetch(
      `http://127.0.0.1:${address.port}/api/cases/${caseId}/scans/${scanId}/image`,
      { headers: { Authorization: `Bearer ${ownerToken}` } },
    )
    assert.equal(imageResponse.status, 200)
    assert.deepEqual(Buffer.from(await imageResponse.arrayBuffer()), imageBytes)
    const unauthorizedImage = await fetch(
      `http://127.0.0.1:${address.port}/api/cases/${caseId}/scans/${scanId}/image`,
    )
    assert.equal(unauthorizedImage.status, 401)
    const otherOwnerImage = await fetch(
      `http://127.0.0.1:${address.port}/api/cases/${caseId}/scans/${scanId}/image`,
      { headers: { Authorization: `Bearer ${otherOwnerBody.ownerAccessToken}` } },
    )
    assert.equal(otherOwnerImage.status, 404)
    const otherCaseImage = await fetch(
      `http://127.0.0.1:${address.port}/api/cases/${otherOwnerBody.case.caseId}/scans/${scanId}/image`,
      { headers: { Authorization: `Bearer ${ownerToken}` } },
    )
    assert.equal(otherCaseImage.status, 404)

    const mismatchedImageScanId = randomUUID()
    await ScanModel.create({
      scanId: mismatchedImageScanId,
      caseId,
      ownerId: owner.ownerId,
      imageRef,
      image: { width: 1200, height: 900 },
      samModel: 'sam-3.1',
      leafDetected: false,
      leafPixelCount: null,
      affectedPixelCount: null,
      affectedPercent: null,
      measurementQuality: 'unavailable',
    })
    cleanupIds.scanIds.push(mismatchedImageScanId)
    const mismatchedImageResponse = await fetch(
      `http://127.0.0.1:${address.port}/api/cases/${caseId}/scans/${mismatchedImageScanId}/image`,
      { headers: { Authorization: `Bearer ${ownerToken}` } },
    )
    assert.equal(mismatchedImageResponse.status, 404)

    const missingImageScanId = randomUUID()
    await ScanModel.create({
      scanId: missingImageScanId,
      caseId,
      ownerId: owner.ownerId,
      imageRef: `${owner.ownerId}/${caseId}/${missingImageScanId}.jpg`,
      image: { width: 1200, height: 900 },
      samModel: 'sam-3.1',
      leafDetected: false,
      leafPixelCount: null,
      affectedPixelCount: null,
      affectedPercent: null,
      measurementQuality: 'unavailable',
    })
    cleanupIds.scanIds.push(missingImageScanId)
    const missingImageResponse = await fetch(
      `http://127.0.0.1:${address.port}/api/cases/${caseId}/scans/${missingImageScanId}/image`,
      { headers: { Authorization: `Bearer ${ownerToken}` } },
    )
    assert.equal(missingImageResponse.status, 404)
    assert.equal(
      (await missingImageResponse.json() as { errorCode: string }).errorCode,
      'IMAGE_NOT_FOUND',
    )

    const rollbackCaseId = randomUUID()
    cleanupIds.caseIds.push(rollbackCaseId)
    await CaseModel.create({
      caseId: rollbackCaseId,
      ownerId: owner.ownerId,
      crop: 'rice',
      language: 'en',
      status: 'active',
      scanIds: [],
      lastScanAt: null,
      nextRecheckAt: null,
    })

    const failedSubmissionId = randomUUID()
    const conflictingRecheckId = randomUUID()
    cleanupIds.recheckIds.push(conflictingRecheckId)
    await RecheckModel.create({
      recheckId: conflictingRecheckId,
      submissionId: failedSubmissionId,
      caseId: otherOwnerBody.case.caseId,
      ownerId: otherOwner.ownerId,
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

    const rollbackImage = await sharp({
      create: {
        width: 1,
        height: 1,
        channels: 3,
        background: { r: 24, g: 128, b: 48 },
      },
    }).png().toBuffer()
    const storedRollbackRefs: PrivateImageReference[] = []
    const removedRollbackRefs: PrivateImageReference[] = []
    const rollbackStorage: PrivateImageStorage = {
      put: async (key, bytes, contentType) => {
        const reference = await privateImageStorage.put(key, bytes, contentType)
        storedRollbackRefs.push(reference)
        return reference
      },
      get: (reference) => privateImageStorage.get(reference),
      remove: async (reference) => {
        removedRollbackRefs.push(reference)
        await privateImageStorage.remove(reference)
      },
    }
    const rollbackAnalysis: SamAnalysis = {
      success: true,
      model: 'sam-3.1',
      image: { width: 1, height: 1 },
      leaf: { detected: false, pixelCount: null },
      affectedArea: { pixelCount: null, percentage: null, status: 'unavailable' },
      objects: [],
      overlay: { imageUrl: null },
      requestIds: [],
    }
    const rollbackApp = express()
    rollbackApp.post(
      '/cases/:caseId/recheck',
      multer({ storage: multer.memoryStorage() }).single('image'),
      createRecheckHandler({
        storage: rollbackStorage,
        segmenter: async () => rollbackAnalysis,
      }),
    )
    const rollbackServer = rollbackApp.listen(0)
    await once(rollbackServer, 'listening')
    const rollbackAddress = rollbackServer.address()
    assert.ok(rollbackAddress && typeof rollbackAddress !== 'string')
    try {
      const uploadForm = new FormData()
      uploadForm.set('language', 'en')
      uploadForm.set('observations', '')
      uploadForm.set('image', new Blob([rollbackImage], { type: 'image/png' }), 'rollback.png')
      const failedRecheck = await fetch(
        `http://127.0.0.1:${rollbackAddress.port}/cases/${rollbackCaseId}/recheck`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${ownerToken}`,
            'Idempotency-Key': failedSubmissionId,
          },
          body: uploadForm,
        },
      )
      assert.equal(failedRecheck.status, 503)
      assert.equal(
        (await failedRecheck.json() as { errorCode: string }).errorCode,
        'PERSISTENCE_FAILED',
      )
    } finally {
      const closed = new Promise<void>((resolve, reject) => {
        rollbackServer.close((error) => error ? reject(error) : resolve())
      })
      rollbackServer.closeAllConnections()
      await closed
    }
    assert.equal(storedRollbackRefs.length, 1)
    assert.deepEqual(removedRollbackRefs, storedRollbackRefs)
    const rolledBackReference = storedRollbackRefs[0]
    assert.ok(rolledBackReference)
    await assert.rejects(rollbackStorage.get(rolledBackReference))
    const failedScanId = typeof rolledBackReference === 'string'
      ? rolledBackReference.split('/').at(-1)?.replace(/\.(?:jpg|png|webp)$/, '')
      : rolledBackReference.publicId.split('/').at(-1)
    assert.ok(failedScanId)
    assert.equal(
      await ScanModel.exists({ scanId: failedScanId, ownerId: owner.ownerId }),
      null,
    )

    const recheckId = randomUUID()
    cleanupIds.recheckIds.push(recheckId)
    await RecheckModel.create({
      recheckId,
      submissionId: randomUUID(),
      caseId,
      ownerId: owner.ownerId,
      previousScanId: null,
      currentScanId: scanId,
      intendedDate: null,
      completedAt: new Date(),
      observations: 'No validated affected-area value is available.',
      comparison: null,
      assessment: {
        language: 'en',
        text: 'There is no earlier scan available for comparison.',
        generatedBy: 'fallback',
      },
      status: 'completed',
    })

    const analysis: SamAnalysis = {
      success: true,
      model: 'sam-3.1',
      image: { width: 1200, height: 900 },
      leaf: { detected: true, pixelCount: 400 },
      affectedArea: { pixelCount: null, percentage: null, status: 'unavailable' },
      objects: [],
      overlay: { imageUrl: null },
      requestIds: [],
    }
    const savedAgentScan = await new MongoScanStore().create('rice', 'brown spots', analysis)
    cleanupIds.agentScanIds.push(savedAgentScan.scanId)

    const sessions = new MongoSessionStore()
    const createdSession = await sessions.create({
      scanId: savedAgentScan.scanId,
      crop: 'rice',
      language: 'en',
      farmerQuestion: 'What should I observe next?',
      status: 'awaiting_farmer',
      modelTurns: 1,
      answerCount: 0,
      pendingFunctionOutputs: [],
      pendingQuestion: {
        question: 'When did you first notice the spots?',
        why: 'The timing may help guide follow-up questions.',
        callId: 'integration-call',
      },
      trace: [{
        step: 1,
        timestamp: new Date().toISOString(),
        toolName: 'ask_farmer',
        summary: 'Asked one bounded follow-up question.',
        status: 'success',
        durationMs: 1,
        evidenceReferenceIds: [],
      }],
      retrievedSourceIds: [],
      toolCallFingerprints: [],
    })
    cleanupIds.investigationIds.push(createdSession.session.id)
    await sessions.save(createdSession.session)

    const closed = new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve())
    })
    server.closeAllConnections()
    await closed
    await disconnectDatabase()

    const firstRestart = await startApiProcess()
    apiProcess = firstRestart.child
    const firstRestartSession = await fetch(
      `${firstRestart.baseUrl}/api/agent/${createdSession.session.id}`,
      { headers: { Authorization: `Bearer ${createdSession.accessToken}` } },
    )
    assert.equal(firstRestartSession.status, 200)
    const firstRestartState = await firstRestartSession.json() as {
      status: string
      pendingQuestion?: { question: string }
    }
    assert.equal(firstRestartState.status, 'awaiting_farmer')
    assert.equal(firstRestartState.pendingQuestion?.question, 'When did you first notice the spots?')
    await stopApiProcess(apiProcess)
    apiProcess = undefined

    const restartedProcess = await startApiProcess()
    apiProcess = restartedProcess.child

    const caseAfterRestart = await fetch(
      `${restartedProcess.baseUrl}/api/cases/${caseId}`,
      { headers: { Authorization: `Bearer ${ownerToken}` } },
    )
    assert.equal(caseAfterRestart.status, 200)
    const unauthorizedAfterRestart = await fetch(
      `${restartedProcess.baseUrl}/api/cases/${caseId}`,
    )
    assert.equal(unauthorizedAfterRestart.status, 401)
    const savedImageAfterRestart = await fetch(
      `${restartedProcess.baseUrl}/api/cases/${caseId}/scans/${scanId}/image`,
      { headers: { Authorization: `Bearer ${ownerToken}` } },
    )
    assert.equal(savedImageAfterRestart.status, 200)
    assert.deepEqual(
      Buffer.from(await savedImageAfterRestart.arrayBuffer()),
      imageBytes,
    )

    await stopApiProcess(apiProcess)
    apiProcess = undefined
    await connectDatabase()

    const recovered = await new MongoSessionStore().getAuthorized(
      createdSession.session.id,
      createdSession.accessToken,
    )
    assert.equal(recovered?.status, 'awaiting_farmer')
    assert.equal(recovered?.pendingQuestion?.question, 'When did you first notice the spots?')
    assert.equal(
      (await new MongoScanStore().get(savedAgentScan.scanId))?.analysis.affectedArea.percentage,
      null,
    )
    assert.equal(
      (await RecheckModel.findOne({ recheckId }).lean())?.comparison,
      null,
    )
    assert.equal(
      (await CaseModel.findOne({ caseId, ownerId: owner.ownerId }).lean())?.scanIds.includes(scanId),
      true,
    )

    const firstRead = await new MongoSessionStore().getAuthorized(
      createdSession.session.id,
      createdSession.accessToken,
    )
    const concurrentRead = await new MongoSessionStore().getAuthorized(
      createdSession.session.id,
      createdSession.accessToken,
    )
    assert.ok(firstRead && concurrentRead)
    firstRead.answerCount += 1
    await new MongoSessionStore().save(firstRead)
    concurrentRead.answerCount += 1
    await assert.rejects(new MongoSessionStore().save(concurrentRead), SessionConflictError)
  } finally {
    if (apiProcess) await stopApiProcess(apiProcess)
    if (server.listening) {
      server.closeAllConnections()
      await new Promise<void>((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve())
      })
    }
    if (
      !mongooseReady() &&
      (
        cleanupIds.caseIds.length > 0 ||
        cleanupIds.investigationIds.length > 0 ||
        cleanupIds.agentScanIds.length > 0
      )
    ) {
      await connectDatabase()
    }
    if (mongooseReady()) {
      await Promise.all([
        CaseModel.deleteMany({ caseId: { $in: cleanupIds.caseIds } }),
        ScanModel.deleteMany({ scanId: { $in: cleanupIds.scanIds } }),
        RecheckModel.deleteMany({ recheckId: { $in: cleanupIds.recheckIds } }),
        AnonymousOwnerModel.deleteMany({ ownerId: { $in: cleanupIds.ownerIds } }),
        AgentScanModel.deleteMany({ scanId: { $in: cleanupIds.agentScanIds } }),
        InvestigationModel.deleteMany({ investigationId: { $in: cleanupIds.investigationIds } }),
        TraceModel.deleteMany({ investigationId: { $in: cleanupIds.investigationIds } }),
      ])
      await disconnectDatabase()
    }
    await Promise.all(imageRefs.map((imageRef) => privateImageStorage.remove(imageRef)))
  }
})

function mongooseReady(): boolean {
  return mongoose.connection.readyState === 1
}
