import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Readable } from 'node:stream'
import test from 'node:test'
import {
  CloudinaryPrivateImageStorage,
  type CloudinaryGateway,
  type CloudinaryUploadOptions,
} from '../src/services/cloudinaryPrivateImageStorage.js'
import {
  LocalPrivateImageStorage,
  PrivateImageNotFoundError,
  PrivateImageStorageError,
  type CloudinaryImageReference,
} from '../src/services/privateImageStorage.js'

const credentials = {
  cloudName: 'test-cloud',
  apiKey: 'test-key',
  apiSecret: 'test-secret',
}

const storageKey =
  '0cbb497b-851e-4538-9068-850c1fe2d46c/0d87a85d-712d-4c4d-b4d1-10c167100000/1557bce5-8dfb-4bf8-b849-5a21690a9e83.jpg'

function reference(): CloudinaryImageReference {
  return {
    provider: 'cloudinary',
    publicId: 'krishilens/0cbb497b-851e-4538-9068-850c1fe2d46c/0d87a85d-712d-4c4d-b4d1-10c167100000/1557bce5-8dfb-4bf8-b849-5a21690a9e83',
    assetId: 'asset-id',
    resourceType: 'image',
    format: 'jpg',
    deliveryType: 'authenticated',
  }
}

function mockGateway(overrides: Partial<CloudinaryGateway> = {}) {
  const calls: {
    upload?: { image: Buffer; options: CloudinaryUploadOptions }
    downloadUrl?: { publicId: string; format: string; expiresAt: number }
    downloadedUrl?: string
    destroyedPublicIds: string[]
    destroyedDeliveryTypes: string[]
  } = { destroyedPublicIds: [], destroyedDeliveryTypes: [] }
  const gateway: CloudinaryGateway = {
    upload: async (image, options) => {
      calls.upload = { image, options }
      return {
        public_id: options.public_id,
        asset_id: 'asset-id',
        resource_type: 'image',
        type: 'authenticated',
        format: 'jpg',
      }
    },
    privateDownloadUrl: (publicId, format, expiresAt) => {
      calls.downloadUrl = { publicId, format, expiresAt }
      return 'https://api.cloudinary.com/v1_1/test/image/download/signed'
    },
    destroy: async (publicId, deliveryType = 'authenticated') => {
      calls.destroyedPublicIds.push(publicId)
      calls.destroyedDeliveryTypes.push(deliveryType)
      return { result: 'ok' }
    },
    download: async (url) => {
      calls.downloadedUrl = url
      return new Response(new Uint8Array([1, 2, 3]))
    },
    ...overrides,
  }
  return { calls, gateway }
}

async function readStream(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk))
  }
  return Buffer.concat(chunks)
}

test('local private image storage writes, reads, and removes image bytes', async () => {
  const root = await mkdtemp(join(tmpdir(), 'krishilens-images-'))
  const storage = new LocalPrivateImageStorage(root)
  const key = `${randomUUID()}/${randomUUID()}/${randomUUID()}.jpg`
  try {
    await storage.put(key, Buffer.from('private image bytes'))
    const stored = await storage.get(key)
    assert.equal(stored.contentType, 'image/jpeg')
    assert.equal((await readStream(stored.stream)).toString(), 'private image bytes')
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

test('Cloudinary uploads buffers as authenticated and returns safe asset metadata', async () => {
  const { calls, gateway } = mockGateway()
  const storage = new CloudinaryPrivateImageStorage(
    credentials,
    new LocalPrivateImageStorage('/tmp/krishilens-cloudinary-local'),
    gateway,
  )
  const image = Buffer.from('test image')

  const storedReference = await storage.put(storageKey, image, 'image/jpeg')

  assert.deepEqual(calls.upload?.image, image)
  assert.equal(calls.upload?.options.type, 'authenticated')
  assert.equal(calls.upload?.options.resource_type, 'image')
  assert.equal(calls.upload?.options.public_id, `krishilens/${storageKey.slice(0, -4)}`)
  assert.equal(calls.upload?.options.overwrite, false)
  assert.deepEqual(storedReference, {
    provider: 'cloudinary',
    publicId: `krishilens/${storageKey.slice(0, -4)}`,
    assetId: 'asset-id',
    resourceType: 'image',
    format: 'jpg',
    deliveryType: 'authenticated',
  })
})

test('Cloudinary retrieval uses an internal short-lived signed download and streams bytes', async () => {
  const { calls, gateway } = mockGateway()
  const storage = new CloudinaryPrivateImageStorage(credentials, undefined, gateway)

  const downloaded = await storage.get(reference())

  assert.equal(calls.downloadUrl?.publicId, reference().publicId)
  assert.equal(calls.downloadUrl?.format, 'jpg')
  assert.ok(calls.downloadUrl!.expiresAt >= Math.floor(Date.now() / 1000))
  assert.ok(calls.downloadUrl!.expiresAt <= Math.floor(Date.now() / 1000) + 60)
  assert.match(calls.downloadedUrl ?? '', /^https:\/\/api\.cloudinary\.com\//)
  assert.equal(downloaded.contentType, 'image/jpeg')
  assert.deepEqual(await readStream(downloaded.stream), Buffer.from([1, 2, 3]))
})

test('Cloudinary missing assets are reported as not found', async () => {
  const { gateway } = mockGateway({
    download: async () => new Response(null, { status: 404 }),
  })
  const storage = new CloudinaryPrivateImageStorage(credentials, undefined, gateway)

  await assert.rejects(storage.get(reference()), PrivateImageNotFoundError)
})

test('Cloudinary credential failures clean up possible partial assets', async () => {
  const { calls, gateway } = mockGateway({
    upload: async () => {
      throw new Error('simulated provider authentication failure')
    },
  })
  const storage = new CloudinaryPrivateImageStorage(credentials, undefined, gateway)

  await assert.rejects(
    storage.put(storageKey, Buffer.from('test image')),
    PrivateImageStorageError,
  )
  assert.deepEqual(calls.destroyedPublicIds, [
    `krishilens/${storageKey.slice(0, -4)}`,
  ])
})

test('Cloudinary rejects and removes assets returned with public delivery', async () => {
  const { calls, gateway } = mockGateway({
    upload: async (_image, options) => ({
      public_id: options.public_id,
      asset_id: 'asset-id',
      resource_type: 'image',
      type: 'upload',
      format: 'png',
    }),
  })
  const storage = new CloudinaryPrivateImageStorage(credentials, undefined, gateway)

  await assert.rejects(
    storage.put(storageKey, Buffer.from('test image')),
    /required private settings/,
  )
  assert.deepEqual(calls.destroyedDeliveryTypes, ['upload'])
})

test('Cloudinary deletion uses the stored asset reference', async () => {
  const { calls, gateway } = mockGateway()
  const storage = new CloudinaryPrivateImageStorage(credentials, undefined, gateway)

  await storage.remove(reference())

  assert.deepEqual(calls.destroyedPublicIds, [reference().publicId])
  assert.deepEqual(calls.destroyedDeliveryTypes, ['authenticated'])
})

test('Cloudinary adapter rejects invalid credentials and arbitrary asset references', async () => {
  assert.throws(
    () => new CloudinaryPrivateImageStorage(
      { cloudName: '', apiKey: '', apiSecret: '' },
    ),
    /requires CLOUDINARY_CLOUD_NAME/,
  )
  const { calls, gateway } = mockGateway()
  const storage = new CloudinaryPrivateImageStorage(credentials, undefined, gateway)

  await assert.rejects(storage.get({
    ...reference(),
    publicId: 'arbitrary-user-supplied-id',
  }), PrivateImageNotFoundError)
  assert.equal(calls.downloadUrl, undefined)
})
