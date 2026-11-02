import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createE2eRunManifest,
  databaseNameForRun,
  databaseUriForRun,
  parseE2eRunManifest,
  publicIdBelongsToOwner,
} from '../src/services/e2eIsolation.js'

const runId = 'c3989d3d-c2d5-4968-ae22-de5d8a9f804c'
const ownerId = '01980f28-7d70-4ac4-8fb4-02acb3ea3702'

test('E2E manifest only authorizes its exact generated disposable database', () => {
  const manifest = createE2eRunManifest(runId, ownerId)
  assert.equal(
    manifest.databaseName,
    'krishilens_e2e_c3989d3dc2d54968ae22de5d8a9f804c',
  )
  assert.deepEqual(parseE2eRunManifest(manifest), manifest)
  assert.throws(
    () => parseE2eRunManifest({ ...manifest, databaseName: 'krishilens' }),
    /Invalid E2E cleanup manifest/,
  )
  assert.throws(
    () => databaseNameForRun('../../production'),
    /Invalid E2E run identifier/,
  )
  assert.throws(
    () => databaseUriForRun(
      'mongodb://localhost:27017/production',
      'production',
    ),
    /disposable E2E namespace/,
  )
})

test('run database URI preserves the host and connection options', () => {
  const uri = databaseUriForRun(
    'mongodb+srv://qa-user:qa-password@example.test/source?retryWrites=true&w=majority',
    databaseNameForRun(runId),
  )
  const parsed = new URL(uri)
  assert.equal(parsed.hostname, 'example.test')
  assert.equal(parsed.pathname, '/krishilens_e2e_c3989d3dc2d54968ae22de5d8a9f804c')
  assert.equal(parsed.searchParams.get('retryWrites'), 'true')
  assert.equal(parsed.searchParams.get('w'), 'majority')
})

test('Cloudinary cleanup accepts only the exact owner UUID asset hierarchy', () => {
  assert.equal(
    publicIdBelongsToOwner(
      `krishilens/${ownerId}/${runId}/01980f28-7d70-4ac4-8fb4-02acb3ea3703`,
      ownerId,
    ),
    true,
  )
  assert.equal(
    publicIdBelongsToOwner(
      `krishilens/${ownerId}/not-a-case/01980f28-7d70-4ac4-8fb4-02acb3ea3703`,
      ownerId,
    ),
    false,
  )
  assert.equal(
    publicIdBelongsToOwner(
      `krishilens/${runId}/${runId}/01980f28-7d70-4ac4-8fb4-02acb3ea3703`,
      ownerId,
    ),
    false,
  )
})
