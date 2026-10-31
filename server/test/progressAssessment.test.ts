import assert from 'node:assert/strict'
import test from 'node:test'
import { explainProgress } from '../src/services/progressAssessment.js'

test('a first re-check identifies its standard note as built-in, not an AI outage', async () => {
  const result = await explainProgress(null, '', 'en')

  assert.equal(result.generatedBy, 'built_in')
  assert.match(result.text, /no earlier scan available/i)
})
