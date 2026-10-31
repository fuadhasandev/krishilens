import assert from 'node:assert/strict'
import test from 'node:test'
import type { InvestigationReport } from '../src/agent/types.js'
import { translateInvestigationText } from '../src/services/reportTranslation.js'

function report(): InvestigationReport {
  return {
    caseId: '4c4a0d82-e14c-40ea-8053-723c3377d8c6',
    cropType: 'rice',
    language: 'en',
    summary: 'The scan found 6284 leaf mask pixels, but no confirmed cause.',
    visibleObservations: [
      { id: 'leaf', description: 'SAM returned 6284 mask pixels.' },
    ],
    possibleCauses: [
      {
        cause: 'The cause is uncertain.',
        evidenceLevel: 'insufficient_evidence',
        supportingEvidence: [
          {
            type: 'observation',
            referenceId: 'leaf',
            description: 'The scan found 6284 pixels.',
          },
        ],
      },
    ],
    missingInformation: ['When did the spots first appear?'],
    safeNextSteps: ['Record new symptoms over 3 days.'],
    citations: [{ sourceId: 'brri', title: 'BRRI', url: 'https://brri.gov.bd/' }],
    evidenceStatus: 'insufficient_evidence',
    escalationRecommendation: {
      recommended: true,
      reason: 'Ask a local agricultural officer.',
    },
    segmentationMeasurementQuality: {
      status: 'needs_review',
      leafPixelCount: 6284,
      affectedPixelCount: null,
      percentage: null,
    },
  }
}

function modelResult(answer: unknown) {
  return async () => ({ answer: JSON.stringify(answer), model: 'test', requestId: 'test' })
}

function translatedText() {
  return {
    summary: 'স্ক্যানে পাতার মাস্কের ৬২৮৪টি পিক্সেল পাওয়া গেছে, তবে কারণ নিশ্চিত নয়।',
    visibleObservations: [
      { id: 'leaf', description: 'SAM মাস্কের ৬২৮৪টি পিক্সেল দেখিয়েছে।' },
    ],
    possibleCauses: [
      {
        cause: 'কারণটি নিশ্চিত নয়।',
        supportingEvidence: [
          {
            type: 'observation',
            referenceId: 'leaf',
            description: 'স্ক্যানে ৬২৮৪টি পিক্সেল পাওয়া গেছে।',
          },
        ],
      },
    ],
    missingInformation: ['দাগ প্রথম কবে দেখা গেছে?'],
    safeNextSteps: ['৩ দিন ধরে নতুন লক্ষণ লিখে রাখুন।'],
    escalationReason: 'স্থানীয় কৃষি কর্মকর্তার পরামর্শ নিন।',
    pendingQuestion: {
      question: 'পাশের গাছেও কি একই দাগ দেখা যাচ্ছে?',
      why: 'পাশের গাছের লক্ষণ জানলে বিস্তার বোঝা যায়।',
    },
  }
}

test('translates report and follow-up prose while preserving measurements, IDs, and citations', async () => {
  const original = report()
  const pendingQuestion = {
    question: 'Are nearby plants showing similar spots?',
    why: 'This helps assess how the symptoms are spreading.',
  }
  const result = await translateInvestigationText(
    original,
    'bn',
    pendingQuestion,
    modelResult(translatedText()),
  )

  assert.equal(result.report.language, 'bn')
  assert.equal(result.report.summary, translatedText().summary)
  assert.deepEqual(result.report.segmentationMeasurementQuality, original.segmentationMeasurementQuality)
  assert.deepEqual(result.report.visibleObservations.map(({ id }) => id), ['leaf'])
  assert.deepEqual(result.report.citations, original.citations)
  assert.deepEqual(result.pendingQuestion, translatedText().pendingQuestion)
  assert.equal(original.language, 'en')
  assert.equal(original.summary, 'The scan found 6284 leaf mask pixels, but no confirmed cause.')
})

test('rejects a translation that changes the numeric observation', async () => {
  const translated = translatedText()
  translated.visibleObservations[0]!.description = 'SAM মাস্কের ১২টি পিক্সেল দেখিয়েছে।'
  delete translated.pendingQuestion
  await assert.rejects(
    translateInvestigationText(
      report(),
      'bn',
      undefined,
      modelResult(translated),
    ),
    /numeric value/,
  )
})
