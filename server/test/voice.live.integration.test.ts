import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import '../src/config/env.js'
import { validatePcmWav } from '../src/services/audioValidation.js'
import { transcribeVoice } from '../src/services/voiceTranscription.js'

const enabled = process.env.RUN_REAL_VOICE_TRANSCRIPTION_TESTS === '1'
const audioConsent =
  'I_HAVE_PERMISSION_TO_SEND_THESE_AUDIO_FIXTURES_TO_META'

async function transcribeFixture(
  path: string | undefined,
  language: 'en' | 'bn',
): Promise<void> {
  if (!path) {
    throw new Error('Provide both explicitly consented WAV fixture paths.')
  }
  const audio = await readFile(path)
  validatePcmWav(audio)
  const transcript = await transcribeVoice(audio, language)
  assert.ok(transcript.trim())
}

test(
  'live Meta voice transcription handles consented English and Bengali fixtures',
  { skip: !enabled },
  async () => {
    if (process.env.VOICE_TEST_AUDIO_CONSENT !== audioConsent) {
      throw new Error('Explicit consent to send the test audio fixtures is required.')
    }
    if (!process.env.MODEL_API_KEY?.trim()) {
      throw new Error('MODEL_API_KEY is required for the opted-in live transcription test.')
    }
    await transcribeFixture(process.env.VOICE_TEST_ENGLISH_WAV, 'en')
    await transcribeFixture(process.env.VOICE_TEST_BENGALI_WAV, 'bn')
  },
)
