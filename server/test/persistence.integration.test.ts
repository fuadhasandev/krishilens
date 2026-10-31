import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'
import { once } from 'node:events'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import mongoose from 'mongoose'
import { app } from '../src/app.js'
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
import { LocalPrivateImageStorage } from '../src/services/privateImageStorage.js'
import type { SamAnalysis } from '../src/services/sam.js'

import '../src/config/env.js'

const enabled = process.env.RUN_MONGODB_INTEGRATION_TESTS === '1'

test('MongoDB persists case, scan image, re-check, and awaiting agent state across reconnect', {
  skip: !enabled,
}, async () => {
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
  const storageRoot = await mkdtemp(join(tmpdir(), 'krishilens-mongo-integration-'))
  const storage = new LocalPrivateImageStorage(storageRoot)
  const imageRefs: string[] = []
  let server = instance

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

    const scanId = randomUUID()
    const imageRef = `${owner.ownerId}/${caseId}/${scanId}.jpg`
    imageRefs.push(imageRef)
    const imageBytes = Buffer.from('protected test image fixture')
    await storage.put(imageRef, imageBytes)
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

    await connectDatabase()
    useMongoScanStore()
    useMongoSessionStore()
    server = app.listen(0)
    await once(server, 'listening')
    const restartedAddress = server.address()
    assert.ok(restartedAddress && typeof restartedAddress !== 'string')

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

    const caseAfterRestart = await fetch(
      `http://127.0.0.1:${restartedAddress.port}/api/cases/${caseId}`,
      { headers: { Authorization: `Bearer ${ownerToken}` } },
    )
    assert.equal(caseAfterRestart.status, 200)

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
    server.closeAllConnections()
    await new Promise<void>((resolve) => server.close(() => resolve()))
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
    await Promise.all(imageRefs.map((imageRef) => storage.remove(imageRef)))
    await rm(storageRoot, { recursive: true, force: true })
  }
})

function mongooseReady(): boolean {
  return mongoose.connection.readyState === 1
}
