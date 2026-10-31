import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { LocalPrivateImageStorage } from '../src/services/privateImageStorage.js'

test('local private image storage writes, reads, and removes image bytes', async () => {
  const root = await mkdtemp(join(tmpdir(), 'krishilens-images-'))
  const storage = new LocalPrivateImageStorage(root)
  const key = '123e4567-e89b-42d3-a456-426614174000/123e4567-e89b-42d3-a456-426614174001/123e4567-e89b-42d3-a456-426614174002.jpg'
  try {
    await storage.put(key, Buffer.from('private image bytes'))
    assert.equal((await storage.get(key)).toString(), 'private image bytes')
    await storage.remove(key)
    await assert.rejects(storage.get(key))
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('local private image storage rejects path traversal references', async () => {
  const storage = new LocalPrivateImageStorage('/tmp/krishilens-private')
  await assert.rejects(storage.get('../../secrets.txt'), /Invalid private image reference/)
})
