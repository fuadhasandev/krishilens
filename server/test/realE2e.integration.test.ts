import assert from 'node:assert/strict'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { spawn, type ChildProcess } from 'node:child_process'
import { once } from 'node:events'
import { mkdir, unlink, writeFile } from 'node:fs/promises'
import { createServer } from 'node:net'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'
import test from 'node:test'

const enabled = process.env.RUN_REAL_E2E_TESTS === '1'
const serverRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const runId = randomUUID()

interface ApiResponse {
  [key: string]: unknown
}

async function availablePort(): Promise<number> {
  const listener = createServer()
  listener.listen(0, '127.0.0.1')
  await once(listener, 'listening')
  const address = listener.address()
  assert.ok(address && typeof address !== 'string')
  await new Promise<void>((resolveClose, reject) => {
    listener.close((error) => error ? reject(error) : resolveClose())
  })
  return address.port
}

async function startApiProcess(): Promise<{ child: ChildProcess; baseUrl: string }> {
  const port = await availablePort()
  const child = spawn(
    process.execPath,
    ['--import', 'tsx', 'src/dev.ts'],
    {
      cwd: serverRoot,
      env: { ...process.env, PORT: String(port) },
      stdio: 'ignore',
    },
  )

  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error('Disposable E2E API process exited before becoming ready.')
    }
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/health`, {
        signal: AbortSignal.timeout(2_000),
      })
      if (response.ok) return { child, baseUrl: `http://127.0.0.1:${port}` }
    } catch {
      await delay(500)
    }
  }
  await stopApiProcess(child)
  throw new Error('Disposable E2E API did not become ready.')
}

async function stopApiProcess(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return
  const exited = once(child, 'exit')
  child.kill('SIGTERM')
  await Promise.race([exited, delay(10_000)])
  if (child.exitCode === null && child.signalCode === null) {
    child.kill('SIGKILL')
    await exited
  }
}

async function apiRequest(
  baseUrl: string,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  return fetch(`${baseUrl}${path}`, {
    ...init,
    signal: AbortSignal.timeout(600_000),
  })
}

async function expectJson(
  response: Response,
  status: number,
): Promise<ApiResponse> {
  assert.equal(response.status, status, `Unexpected API HTTP status ${response.status}.`)
  return await response.json() as ApiResponse
}

async function downloadLicensedFixture(url: string): Promise<Buffer> {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'KrishiLens disposable integration test' },
    signal: AbortSignal.timeout(30_000),
  })
  assert.equal(response.status, 200, 'Licensed crop-image fixture download failed.')
  assert.match(
    response.headers.get('content-type') ?? '',
    /^image\/jpeg(?:;|$)/i,
    'Licensed crop-image fixture was not a JPEG.',
  )
  const bytes = Buffer.from(await response.arrayBuffer())
  assert.ok(bytes.length > 0 && bytes.length <= 4 * 1024 * 1024)
  return bytes
}

function makeUpload(image: Buffer, name: string, language: 'en' | 'bn'): FormData {
  const form = new FormData()
  form.set('image', new Blob([new Uint8Array(image)], { type: 'image/jpeg' }), name)
  form.set('language', language)
  form.set('observations', 'The visible marks differ between these two licensed example photos.')
  form.set('similarLighting', 'false')
  form.set('similarAngle', 'false')
  form.set('samePlantRegion', 'false')
  return form
}

test('real SAM, Muse, Cloudinary, MongoDB and restart E2E workflow', {
  skip: !enabled,
  timeout: 1_200_000,
}, async () => {
  const dotenv = await import('dotenv')
  dotenv.config({ path: resolve(serverRoot, '.env.e2e'), override: true })

  const isolation = await import('../src/services/e2eIsolation.js')
  const configuration = isolation.readE2eConfiguration()
  const ownerId = randomUUID()
  const manifest = isolation.createE2eRunManifest(runId, ownerId)
  process.env.MONGODB_URI = isolation.databaseUriForRun(
    configuration.baseMongoUri,
    manifest.databaseName,
  )
  process.env.MODEL_API_KEY = configuration.modelApiKey
  process.env.META_BASE_URL =
    process.env.E2E_META_BASE_URL?.trim() || 'https://api.meta.ai/v1'
  process.env.IMAGE_STORAGE_PROVIDER = 'cloudinary'
  process.env.CLOUDINARY_CLOUD_NAME = configuration.cloudinaryCloudName
  process.env.CLOUDINARY_API_KEY = configuration.cloudinaryApiKey
  process.env.CLOUDINARY_API_SECRET = configuration.cloudinaryApiSecret
  process.env.NODE_ENV = 'production'
  process.env.CLIENT_URL = 'https://krishilens-nine.vercel.app'

  const manifestPath = resolve(serverRoot, '.e2e-runs', `${runId}.json`)
  let child: ChildProcess | undefined
  let cleanupComplete = false
  let primaryFailure: unknown
  let canCleanup = true

  try {
    await mkdir(dirname(manifestPath), { recursive: true, mode: 0o700 })
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, {
      encoding: 'utf8',
      mode: 0o600,
      flag: 'wx',
    })

    const [{ connectDatabase, disconnectDatabase }, { AnonymousOwnerModel }] =
      await Promise.all([
        import('../src/config/database.js'),
        import('../src/models/index.js'),
      ])
    await connectDatabase()

    const ownerToken = randomBytes(32).toString('base64url')
    await AnonymousOwnerModel.create({
      ownerId,
      tokenHash: createHash('sha256').update(ownerToken).digest('hex'),
      expiresAt: new Date(Date.now() + 5 * 365 * 24 * 60 * 60 * 1000),
    })

    const firstImage = await downloadLicensedFixture(
      'https://upload.wikimedia.org/wikipedia/commons/1/15/RiceSheathArk.jpg',
    )
    const secondImage = await downloadLicensedFixture(
      'https://upload.wikimedia.org/wikipedia/commons/a/af/Leafs_of_rice_plant.jpg',
    )

    console.info('Real E2E: creating disposable rice case.')
    const runningApi = await startApiProcess()
    child = runningApi.child
    const baseUrl = runningApi.baseUrl

    const ownerHeaders = { Authorization: `Bearer ${ownerToken}` }
    const caseResponse = await expectJson(
      await apiRequest(baseUrl, '/api/cases', {
        method: 'POST',
        headers: { ...ownerHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ crop: 'rice', language: 'en' }),
      }),
      201,
    )
    const createdCase = caseResponse.case as { caseId?: string } | undefined
    assert.ok(createdCase?.caseId)
    const caseId = createdCase.caseId

    console.info('Real E2E: uploading the first licensed image to real SAM and Cloudinary.')
    const firstRecheckResponse = await expectJson(
      await apiRequest(baseUrl, `/api/cases/${caseId}/recheck`, {
        method: 'POST',
        headers: {
          ...ownerHeaders,
          'Idempotency-Key': randomUUID(),
        },
        body: makeUpload(firstImage, 'rice-sheath-blight.jpg', 'en'),
      }),
      201,
    )
    const firstScan = firstRecheckResponse.scan as {
      scanId?: string
      samModel?: string
    } | undefined
    assert.ok(firstScan?.scanId)
    assert.equal(firstScan.samModel, 'sam-3.1')
    const firstScanId = firstScan.scanId

    const { ScanModel } = await import('../src/models/index.js')
    const savedFirstScan = await ScanModel.findOne({ scanId: firstScanId, ownerId }).lean()
    assert.ok(savedFirstScan)
    assert.equal(typeof savedFirstScan.imageRef, 'object')
    if (typeof savedFirstScan.imageRef === 'string') {
      assert.fail('The first scan was not saved to private Cloudinary storage.')
    }
    assert.equal(savedFirstScan.imageRef.provider, 'cloudinary')
    assert.equal(savedFirstScan.imageRef.deliveryType, 'authenticated')

    const unauthorizedImage = await apiRequest(
      baseUrl,
      `/api/cases/${caseId}/scans/${firstScanId}/image`,
    )
    assert.equal(unauthorizedImage.status, 401)
    const authorizedImage = await apiRequest(
      baseUrl,
      `/api/cases/${caseId}/scans/${firstScanId}/image`,
      { headers: ownerHeaders },
    )
    assert.equal(authorizedImage.status, 200)
    assert.match(authorizedImage.headers.get('content-type') ?? '', /^image\/jpeg/i)
    assert.ok((await authorizedImage.arrayBuffer()).byteLength > 0)

    const publicImageResponse = await fetch(
      `https://res.cloudinary.com/${configuration.cloudinaryCloudName}/image/authenticated/${savedFirstScan.imageRef.publicId}.${savedFirstScan.imageRef.format}`,
      { signal: AbortSignal.timeout(30_000) },
    )
    assert.equal(publicImageResponse.ok, false, 'Authenticated Cloudinary asset was publicly retrievable.')
    await publicImageResponse.body?.cancel()

    console.info('Real E2E: invoking SAM and Muse, then answering a live follow-up.')
    const samForm = new FormData()
    samForm.set('image', new Blob([new Uint8Array(firstImage)], { type: 'image/jpeg' }), 'rice-leaf.jpg')
    samForm.set('crop', 'rice')
    samForm.set('target', 'brown spots')
    samForm.set('language', 'en')
    const samResponse = await expectJson(
      await apiRequest(baseUrl, '/api/images/segment', {
        method: 'POST',
        body: samForm,
      }),
      200,
    )
    assert.equal(samResponse.model, 'sam-3.1')
    assert.equal(samResponse.success, true)
    assert.equal(typeof samResponse.scanAccessToken, 'string')
    const scanId = samResponse.scanId
    const scanAccessToken = samResponse.scanAccessToken
    assert.equal(typeof scanId, 'string')

    const investigationResponse = await expectJson(
      await apiRequest(baseUrl, '/api/agent/investigate', {
        method: 'POST',
        headers: { Authorization: `Bearer ${scanAccessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scanId,
          crop: 'rice',
          language: 'en',
          question: 'I see marks on these rice leaves. Ask me one brief follow-up question before you prepare a cautious report.',
        }),
      }),
      200,
    )
    assert.equal(investigationResponse.status, 'awaiting_farmer')
    const pendingQuestion = investigationResponse.pendingQuestion as
      | { question?: string }
      | undefined
    assert.ok(pendingQuestion?.question)
    const sessionId = investigationResponse.sessionId
    const investigationToken = investigationResponse.accessToken
    assert.equal(typeof sessionId, 'string')
    assert.equal(typeof investigationToken, 'string')

    const answered = await expectJson(
      await apiRequest(baseUrl, `/api/agent/${sessionId}/answer`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${investigationToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          answer: 'The marks are on older leaves; I have not applied any treatment.',
          language: 'en',
        }),
      }),
      200,
    )
    assert.ok(['completed', 'escalated'].includes(String(answered.status)))
    const report = answered.report as {
      language?: string
      evidenceStatus?: string
      missingInformation?: unknown[]
      safeNextSteps?: unknown[]
      citations?: unknown[]
    } | undefined
    assert.ok(report)
    assert.equal(report.language, 'en')
    assert.ok(['supported', 'tentative', 'insufficient_evidence'].includes(String(report.evidenceStatus)))
    assert.ok(Array.isArray(report.missingInformation))
    assert.ok(Array.isArray(report.safeNextSteps))
    assert.ok(Array.isArray(report.citations))
    assert.ok((report.citations?.length ?? 0) > 0)

    const translatedReport = await expectJson(
      await apiRequest(baseUrl, `/api/agent/${sessionId}/translate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${investigationToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ language: 'bn' }),
      }),
      200,
    )
    assert.equal(
      (translatedReport.report as { language?: string } | undefined)?.language,
      'bn',
    )

    console.info('Real E2E: uploading the second licensed image and checking cautiously.')
    const secondRecheckResponse = await expectJson(
      await apiRequest(baseUrl, `/api/cases/${caseId}/recheck`, {
        method: 'POST',
        headers: {
          ...ownerHeaders,
          'Idempotency-Key': randomUUID(),
        },
        body: makeUpload(secondImage, 'rice-leaf-plant.jpg', 'bn'),
      }),
      201,
    )
    const comparison = secondRecheckResponse.comparison as {
      comparable?: boolean
      assessment?: string
      reasons?: string[]
    } | null
    assert.equal(comparison?.comparable, false)
    assert.equal(comparison?.assessment, 'inconclusive')
    assert.ok((comparison?.reasons?.length ?? 0) > 0)

    const recheckAssessment = (
      secondRecheckResponse.recheck as {
        assessment?: { language?: string; text?: string }
      } | undefined
    )?.assessment
    assert.equal(recheckAssessment?.language, 'bn')
    assert.ok(recheckAssessment?.text)
    assert.doesNotMatch(
      recheckAssessment.text,
      /\b(?:confirmed|proven)\s+(?:recovery|treatment success)\b/i,
    )

    const listResponse = await expectJson(
      await apiRequest(baseUrl, '/api/cases', { headers: ownerHeaders }),
      200,
    )
    assert.ok(Array.isArray(listResponse.cases))
    assert.ok((listResponse.cases as Array<{ caseId?: string }>).some((item) => item.caseId === caseId))

    console.info('Real E2E: restarting the API and verifying persisted history and report.')
    await stopApiProcess(child)
    child = undefined
    const restartedApi = await startApiProcess()
    child = restartedApi.child
    const details = await expectJson(
      await apiRequest(restartedApi.baseUrl, `/api/cases/${caseId}`, { headers: ownerHeaders }),
      200,
    )
    assert.equal((details.scans as unknown[]).length, 2)
    assert.equal((details.rechecks as unknown[]).length, 2)
    const persistedImage = await apiRequest(
      restartedApi.baseUrl,
      `/api/cases/${caseId}/scans/${firstScanId}/image`,
      { headers: ownerHeaders },
    )
    assert.equal(persistedImage.status, 200)
    assert.match(persistedImage.headers.get('content-type') ?? '', /^image\/jpeg/i)
    assert.ok((await persistedImage.arrayBuffer()).byteLength > 0)
    const unauthorizedCase = await apiRequest(restartedApi.baseUrl, `/api/cases/${caseId}`)
    assert.equal(unauthorizedCase.status, 401)
    const persistedSession = await expectJson(
      await apiRequest(restartedApi.baseUrl, `/api/agent/${sessionId}`, {
        headers: { Authorization: `Bearer ${investigationToken}` },
      }),
      200,
    )
    assert.ok(['completed', 'escalated'].includes(String(persistedSession.status)))
    assert.equal(
      (persistedSession.report as { language?: string } | undefined)?.language,
      'en',
    )

    await disconnectDatabase()
  } catch (error) {
    primaryFailure = error
  } finally {
    if (child) {
      try {
        await stopApiProcess(child)
      } catch {
        canCleanup = false
      }
    }
    try {
      const { disconnectDatabase } = await import('../src/config/database.js')
      await disconnectDatabase()
    } catch {
      canCleanup = false
    }

    if (canCleanup) {
      try {
        const isolation = await import('../src/services/e2eIsolation.js')
        const configuration = isolation.readE2eConfiguration(false)
        const result = await isolation.cleanupE2eRun(manifest, configuration)
        await unlink(manifestPath)
        cleanupComplete = true
        console.info(
          `Real E2E cleanup verified: ${result.deletedAssets} private image asset(s) and the dedicated database were removed.`,
        )
      } catch {
        canCleanup = false
      }
    }

    if (!canCleanup) {
      console.error(
        `Real E2E cleanup is incomplete. Keep the manifest and rerun: npm run test:e2e:cleanup -- .e2e-runs/${runId}.json`,
      )
    }
  }

  if (primaryFailure) {
    if (!cleanupComplete) {
      throw new Error('Real E2E workflow failed and cleanup is incomplete; see the retained run manifest.')
    }
    throw primaryFailure
  }
  assert.equal(cleanupComplete, true, 'Disposable E2E resources were not fully cleaned up.')
})
