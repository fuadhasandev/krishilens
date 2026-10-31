import assert from 'node:assert/strict'
import test from 'node:test'
import {
  APIConnectionTimeoutError,
  RateLimitError,
} from 'openai'
import { ResponsesStreamSourceError } from '@meta-sam/parser'
import { mapSamProviderError } from '../src/services/sam.js'

test('maps SAM timeouts to a friendly gateway timeout', () => {
  const timeout = new APIConnectionTimeoutError({ message: 'private upstream detail' })
  const mapped = mapSamProviderError(
    new ResponsesStreamSourceError('next', timeout),
  )

  assert.equal(mapped.statusCode, 504)
  assert.match(mapped.message, /too long/i)
  assert.doesNotMatch(mapped.message, /private upstream detail/)
})

test('maps provider rate limits to HTTP 429 with no upstream message', () => {
  const rateLimit = new RateLimitError(
    429,
    {},
    'private provider detail',
    new Headers(),
  )
  const mapped = mapSamProviderError(
    new ResponsesStreamSourceError('next', rateLimit),
  )

  assert.equal(mapped.statusCode, 429)
  assert.match(mapped.message, /busy/i)
  assert.doesNotMatch(mapped.message, /private provider detail/)
})
