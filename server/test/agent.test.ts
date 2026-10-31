import assert from 'node:assert/strict'
import { once } from 'node:events'
import test from 'node:test'
import type OpenAI from 'openai'
import { app } from '../src/app.js'
import {
  checkReportSafety,
  reportDraftSchema,
  type ReportEvidence,
  type ReportDraft,
} from '../src/agent/reportValidator.js'
import { runAgentLoop, type AgentModelResponse } from '../src/agent/loop.js'
import { InMemoryScanStore } from '../src/agent/scanStore.js'
import {
  InMemorySessionStore,
  sessionStore,
} from '../src/agent/sessionStore.js'
import { observationsForScanLanguage } from '../src/agent/tools/inspectScan.js'
import { riceGuidanceSources } from '../src/agent/tools/riceGuidance.js'
import { executeToolCall } from '../src/agent/toolRegistry.js'
import type { AgentSession, Crop, StoredScan } from '../src/agent/types.js'
import { MetaServiceError } from '../src/services/meta.js'
import type { SamAnalysis } from '../src/services/sam.js'

function analysis(
  status: SamAnalysis['affectedArea']['status'] = 'needs_review',
): SamAnalysis {
  return {
    success: true,
    model: 'sam-3.1',
    image: { width: 4, height: 4 },
    leaf: { detected: true, pixelCount: 8 },
    affectedArea: {
      status,
      pixelCount: status === 'accepted' ? 2 : null,
      percentage: status === 'accepted' ? 25 : null,
    },
    objects: [{ id: 'candidate-1', label: 'brown spots', boundingBox: [0, 0, 1, 1] }],
    overlay: { imageUrl: null },
    requestIds: ['sam-response-id'],
    warning: 'Segmentation is not a diagnosis.',
  }
}

function createTestSession(
  store: InMemorySessionStore,
  scanId: string,
): AgentSession {
  return store.create({
    scanId,
    crop: 'rice',
    language: 'en',
    farmerQuestion: 'There are spots on my rice leaves.',
    status: 'investigating',
    modelTurns: 0,
    answerCount: 0,
    pendingFunctionOutputs: [],
    trace: [],
    retrievedSourceIds: [],
    toolCallFingerprints: [],
  }).session
}

function createScan(
  store: InMemoryScanStore,
  result = analysis(),
): StoredScan {
  const { scanId } = store.create('rice', 'brown spots', result)
  const scan = store.get(scanId)
  assert.ok(scan)
  return scan
}

function toolCall(
  name: string,
  args: unknown,
  callId = `call-${name}`,
): AgentModelResponse['output'][number] {
  return {
    type: 'function_call',
    name,
    arguments: JSON.stringify(args),
    call_id: callId,
  }
}

function response(
  id: string,
  output: AgentModelResponse['output'],
): AgentModelResponse {
  return { id, output }
}

function reportDraft(
  caseId: string,
  overrides: Partial<ReportDraft> = {},
): ReportDraft {
  return {
    caseId,
    cropType: 'rice',
    language: 'en',
    summary:
      'The available scan is a visual segmentation only and cannot identify a crop disease.',
    possibleCauses: [],
    missingInformation: ['When the symptoms first appeared.'],
    safeNextSteps: ['Photograph the affected leaves and compare them over time.'],
    citationIds: [],
    evidenceStatus: 'insufficient_evidence',
    escalationRecommendation: {
      recommended: true,
      reason: 'Consult a qualified local agricultural officer.',
    },
    ...overrides,
  }
}

function evidenceFor(
  session: AgentSession,
  scan: StoredScan,
  sources: ReportEvidence['sources'] = [],
): ReportEvidence {
  return {
    caseId: session.id,
    crop: session.crop,
    language: session.language,
    scan: scan.analysis,
    observations: observationsForScanLanguage(scan, session.language),
    sources,
  }
}

test('inspect_scan returns the original validated observations', async () => {
  const scans = new InMemoryScanStore()
  const scan = createScan(scans)
  const sessions = new InMemorySessionStore()
  const session = createTestSession(sessions, scan.id)
  const result = await executeToolCall(
    'inspect_scan',
    JSON.stringify({ scan_id: scan.id }),
    {
      session,
      scan,
      evidence: evidenceFor(session, scan),
      callId: 'inspect-call',
    },
  )

  assert.equal(result.status, 'success')
  assert.match(result.output, /needs_review/)
  assert.match(result.output, /no affected-area estimate/)
})

test('tool registry rejects invalid arguments and unknown tool names', async () => {
  const scans = new InMemoryScanStore()
  const scan = createScan(scans)
  const sessions = new InMemorySessionStore()
  const session = createTestSession(sessions, scan.id)
  const context = {
    session,
    scan,
    evidence: evidenceFor(session, scan),
    callId: 'bad-call',
  }

  const invalid = await executeToolCall('inspect_scan', '{"scan_id":12}', context)
  assert.equal(invalid.status, 'failure')
  assert.match(invalid.output, /registered schema/)

  const unknown = await executeToolCall('run_shell', '{}', context)
  assert.equal(unknown.status, 'blocked')
  assert.match(unknown.output, /Unknown tool/)
})

test('lookup_guidance reports no symptom-specific evidence when only BRRI portal matches', async () => {
  const scans = new InMemoryScanStore()
  const scan = createScan(scans)
  const sessions = new InMemorySessionStore()
  const session = createTestSession(sessions, scan.id)
  const result = await executeToolCall(
    'lookup_guidance',
    JSON.stringify({ query: 'Bangladesh rice leaf spots' }),
    {
      session,
      scan,
      evidence: evidenceFor(session, scan),
      callId: 'guidance-call',
    },
  )
  const output = JSON.parse(result.output) as {
    status: string
    noEvidence: boolean
    results: Array<{ id: string; url: string }>
  }

  assert.equal(output.status, 'no_relevant_evidence')
  assert.equal(output.noEvidence, true)
  assert.deepEqual(output.results, [
    {
      id: 'brri-official-portal',
      title: 'Bangladesh Rice Research Institute (BRRI) official portal',
      url: 'https://brri.gov.bd/',
      excerpt: riceGuidanceSources[0]?.excerpt,
      scope: 'institutional',
    },
  ])
})

test('multiple function calls are paired with outputs on the next Responses turn', async () => {
  const scans = new InMemoryScanStore()
  const scan = createScan(scans)
  const sessions = new InMemorySessionStore()
  const session = createTestSession(sessions, scan.id)
  const requests: OpenAI.Responses.ResponseCreateParamsNonStreaming[] = []
  const mockResponses = [
    response('resp-first', [
      toolCall('inspect_scan', { scan_id: scan.id }, 'inspect-1'),
      toolCall('lookup_guidance', { query: 'Bangladesh rice spots' }, 'lookup-1'),
    ]),
    response('resp-second', [
      toolCall(
        'ask_farmer',
        {
          question: 'When did the spots first appear?',
          why: 'Timing can help distinguish gradual from sudden changes.',
        },
        'ask-1',
      ),
    ]),
  ]

  await runAgentLoop(session, {
    scans,
    createResponse: async (request) => {
      requests.push(request)
      const next = mockResponses.shift()
      assert.ok(next)
      return next
    },
  })

  assert.equal(session.status, 'awaiting_farmer')
  assert.equal(session.pendingQuestion?.callId, 'ask-1')
  assert.equal(requests.length, 2)
  assert.equal(requests[1]?.previous_response_id, 'resp-first')
  const inputs = requests[1]?.input
  assert.ok(Array.isArray(inputs))
  const toolOutputs = inputs.filter(
    (item) => item.type === 'function_call_output',
  )
  assert.deepEqual(
    toolOutputs.map((item) =>
      item.type === 'function_call_output' ? item.call_id : '',
    ),
    ['inspect-1', 'lookup-1'],
  )
})

test('agent pauses for one follow-up and resumes with the farmer answer', async () => {
  const scans = new InMemoryScanStore()
  const scan = createScan(scans)
  const sessions = new InMemorySessionStore()
  const session = createTestSession(sessions, scan.id)
  session.language = 'bn'
  session.farmerQuestion = 'আমার ধানের পাতায় দাগ দেখা যাচ্ছে।'
  let turn = 0
  const requests: OpenAI.Responses.ResponseCreateParamsNonStreaming[] = []

  await runAgentLoop(session, {
    scans,
    createResponse: async (request) => {
      requests.push(request)
      turn += 1
      if (turn === 1) {
        return response('resp-question', [
          toolCall('inspect_scan', { scan_id: scan.id }, 'inspect-call'),
          toolCall('lookup_guidance', { query: 'Bangladesh rice' }, 'lookup-call'),
          toolCall(
            'ask_farmer',
            {
              question: 'পাশের গাছেও কি একই দাগ দেখা যাচ্ছে?',
              why: 'পাশের গাছের লক্ষণ জানলে বিস্তার বোঝা যায়।',
            },
            'ask-call',
          ),
        ])
      }

      return response('resp-final', [
        toolCall(
          'finalize_report',
          {
            report: reportDraft(session.id, {
              language: 'bn',
              summary: 'স্ক্যানটি রোগ শনাক্ত করতে পারে না।',
              missingInformation: ['দাগ কবে শুরু হয়েছে?'],
              safeNextSteps: ['পাতার ছবি তুলে রাখুন।'],
              escalationRecommendation: {
                recommended: true,
                reason: 'স্থানীয় কৃষি কর্মকর্তার পরামর্শ নিন।',
              },
              citationIds: ['brri-official-portal'],
            }),
          },
          'finalize-call',
        ),
      ])
    },
  })

  assert.equal(session.status, 'awaiting_farmer')
  session.pendingFunctionOutputs.push({
    role: 'user',
    content: 'কৃষকের উত্তর: পাশের দুটি গাছেও দাগ দেখা যাচ্ছে।',
  })
  session.answerCount += 1
  session.pendingQuestion = undefined
  session.status = 'investigating'

  await runAgentLoop(session, {
    scans,
    createResponse: async (request) => {
      requests.push(request)
      return response('resp-final', [
        toolCall(
          'finalize_report',
          {
            report: reportDraft(session.id, {
              language: 'bn',
              summary: 'স্ক্যানটি রোগ শনাক্ত করতে পারে না।',
              missingInformation: ['দাগ কবে শুরু হয়েছে?'],
              safeNextSteps: ['পাতার ছবি তুলে রাখুন।'],
              escalationRecommendation: {
                recommended: true,
                reason: 'স্থানীয় কৃষি কর্মকর্তার পরামর্শ নিন।',
              },
              citationIds: ['brri-official-portal'],
            }),
          },
          'finalize-call',
        ),
      ])
    },
  })

  assert.equal(session.status, 'escalated')
  assert.equal(session.language, 'bn')
  assert.equal(session.report?.language, 'bn')
  assert.equal(session.report?.summary, 'স্ক্যানটি রোগ শনাক্ত করতে পারে না।')
  assert.equal(session.report?.citations[0]?.sourceId, 'brri-official-portal')
  assert.equal(
    session.report?.segmentationMeasurementQuality.percentage,
    null,
  )
  assert.equal(requests[1]?.previous_response_id, 'resp-question')
  const resumeInput = requests[1]?.input
  assert.ok(Array.isArray(resumeInput))
  assert.ok(resumeInput.some((item) => item.type === 'function_call_output'))
  assert.ok(
    resumeInput.some(
      (item) =>
        'role' in item &&
        item.role === 'user' &&
        JSON.stringify(item).includes('পাশের দুটি গাছ'),
    ),
  )
})

test('an unvalidated affected-area measurement remains null in scan observations', () => {
  const scans = new InMemoryScanStore()
  const scan = createScan(scans, analysis('needs_review'))
  const observation = observationsForScanLanguage(scan, 'en').find(
    (item) => item.id === 'sam-candidate-area-needs-review',
  )

  assert.equal(scan.analysis.affectedArea.pixelCount, null)
  assert.equal(scan.analysis.affectedArea.percentage, null)
  assert.match(observation?.description ?? '', /no affected-area estimate/)
})

test('missing scan observations stop before any model request', async () => {
  const sessions = new InMemorySessionStore()
  const session = createTestSession(sessions, '123e4567-e89b-42d3-a456-426614174000')
  let modelCalled = false

  await runAgentLoop(session, {
    scans: new InMemoryScanStore(),
    createResponse: async () => {
      modelCalled = true
      return response('unexpected', [])
    },
  })

  assert.equal(modelCalled, false)
  assert.equal(session.status, 'failed')
  assert.match(session.failureMessage ?? '', /scan has expired/)
})

test('provider timeouts fail safely without exposing provider details', async () => {
  const scans = new InMemoryScanStore()
  const scan = createScan(scans)
  const sessions = new InMemorySessionStore()
  const session = createTestSession(sessions, scan.id)

  await runAgentLoop(session, {
    scans,
    createResponse: async () => {
      throw new MetaServiceError('The AI service took too long to respond.', 504)
    },
  })

  assert.equal(session.status, 'failed')
  assert.equal(session.failureMessage, 'The AI service took too long to respond.')
  assert.equal(session.trace.at(-1)?.error, session.failureMessage)
})

test('the model turn budget is enforced at six calls', async () => {
  const scans = new InMemoryScanStore()
  const scan = createScan(scans)
  const sessions = new InMemorySessionStore()
  const session = createTestSession(sessions, scan.id)
  let calls = 0

  await runAgentLoop(session, {
    scans,
    createResponse: async () => {
      calls += 1
      return response(`resp-${calls}`, [
        toolCall(`unknown_${calls}`, {}, `unknown-call-${calls}`),
      ])
    },
  })

  assert.equal(calls, 6)
  assert.equal(session.modelTurns, 6)
  assert.equal(session.status, 'escalated')
})

test('repeated identical tool calls are blocked without new farmer information', async () => {
  const scans = new InMemoryScanStore()
  const scan = createScan(scans)
  const sessions = new InMemorySessionStore()
  const session = createTestSession(sessions, scan.id)
  let calls = 0

  await runAgentLoop(session, {
    scans,
    createResponse: async () => {
      calls += 1
      return response(`repeat-${calls}`, [
        toolCall('inspect_scan', { scan_id: scan.id }, `inspect-${calls}`),
      ])
    },
  })

  assert.equal(calls, 6)
  assert.ok(session.trace.some((entry) => entry.summary.includes('identical tool call')))
})

test('report safety rejects citations not retrieved for the case', () => {
  const scans = new InMemoryScanStore()
  const scan = createScan(scans)
  const sessions = new InMemorySessionStore()
  const session = createTestSession(sessions, scan.id)
  const result = checkReportSafety(
    reportDraft(session.id, { citationIds: ['invented-source'] }),
    evidenceFor(session, scan),
  )

  assert.equal(result.status, 'revise')
  assert.match(result.reasons.join(' '), /not retrieved/)
})

test('insufficient evidence requires escalation to a qualified officer', () => {
  const scans = new InMemoryScanStore()
  const scan = createScan(scans)
  const sessions = new InMemorySessionStore()
  const session = createTestSession(sessions, scan.id)
  const result = checkReportSafety(
    reportDraft(session.id, {
      escalationRecommendation: { recommended: false, reason: '' },
    }),
    evidenceFor(session, scan),
  )

  assert.equal(result.status, 'escalate')
  assert.match(result.reasons.join(' '), /qualified agricultural officer/)
})

test('report validation rejects extra properties and unsupported percentages', () => {
  const scans = new InMemoryScanStore()
  const scan = createScan(scans)
  const sessions = new InMemorySessionStore()
  const session = createTestSession(sessions, scan.id)
  const draft = reportDraft(session.id)

  assert.equal(reportDraftSchema.safeParse(draft).success, true)
  assert.equal(
    reportDraftSchema.safeParse({ ...draft, modelConfidence: 97 }).success,
    false,
  )

  const result = checkReportSafety(
    reportDraft(session.id, { summary: 'The affected area is 0%.' }),
    evidenceFor(session, scan),
  )
  assert.equal(result.status, 'revise')
  assert.match(result.reasons.join(' '), /percentage/)
})

test('supported claims cannot use the BRRI institutional portal as symptom evidence', () => {
  const scans = new InMemoryScanStore()
  const scan = createScan(scans)
  const sessions = new InMemorySessionStore()
  const session = createTestSession(sessions, scan.id)
  const source = riceGuidanceSources[0]
  assert.ok(source)
  const result = checkReportSafety(
    reportDraft(session.id, {
      possibleCauses: [
        {
          cause: 'Rice blast',
          evidenceLevel: 'supported',
          observationIds: ['sam-leaf-detected'],
          sourceIds: [source.id],
        },
      ],
      citationIds: [source.id],
    }),
    evidenceFor(session, scan, [source]),
  )

  assert.equal(result.status, 'revise')
  assert.match(result.reasons.join(' '), /not symptom-specific agronomic evidence/)
})

test('session access tokens isolate investigations', () => {
  const sessions = new InMemorySessionStore()
  const firstScanId = '123e4567-e89b-42d3-a456-426614174000'
  const { session, accessToken } = sessions.create({
    scanId: firstScanId,
    crop: 'rice',
    language: 'en',
    farmerQuestion: 'Spots on leaves',
    status: 'investigating',
    modelTurns: 0,
    answerCount: 0,
    pendingFunctionOutputs: [],
    trace: [],
    retrievedSourceIds: [],
    toolCallFingerprints: [],
  })

  assert.equal(sessions.getAuthorized(session.id, accessToken)?.id, session.id)
  assert.equal(sessions.getAuthorized(session.id, `${accessToken}x`), null)
  assert.equal(sessions.getAuthorized('123e4567-e89b-42d3-a456-426614174001', accessToken), null)
})

test('GET investigation does not disclose state without the bearer token', async () => {
  const scanId = '123e4567-e89b-42d3-a456-426614174000'
  const { session, accessToken } = await sessionStore.create({
    scanId,
    crop: 'rice',
    language: 'en',
    farmerQuestion: 'A private farmer question.',
    status: 'investigating',
    modelTurns: 0,
    answerCount: 0,
    pendingFunctionOutputs: [],
    trace: [],
    retrievedSourceIds: [],
    toolCallFingerprints: [],
  })
  const server = app.listen(0)
  await once(server, 'listening')
  const address = server.address()
  assert.ok(address && typeof address !== 'string')

  try {
    const url = `http://127.0.0.1:${address.port}/api/agent/${session.id}`
    const unauthorized = await fetch(url)
    assert.equal(unauthorized.status, 401)
    assert.equal((await unauthorized.text()).includes('A private farmer question.'), false)

    const authorized = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    assert.equal(authorized.status, 200)
    assert.match(await authorized.text(), /investigating/)
  } finally {
    server.close()
    await once(server, 'close')
  }
})
