import assert from 'node:assert/strict'
import { once } from 'node:events'
import test, { after, before } from 'node:test'
import type { Server } from 'node:http'
import sharp from 'sharp'
import { app } from '../src/app.js'
import {
  ImageValidationError,
  processUploadedImage,
} from '../src/services/imageProcessing.js'

let server: Server
let baseUrl: string

before(async () => {
  server = app.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  assert.ok(address && typeof address !== 'string')
  baseUrl = `http://127.0.0.1:${address.port}`
})

after(async () => {
  server.closeAllConnections()
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()))
  })
})

async function createPng(): Promise<Buffer> {
  return sharp({
    create: {
      width: 8,
      height: 6,
      channels: 3,
      background: { r: 45, g: 120, b: 55 },
    },
  })
    .png()
    .toBuffer()
}

async function postImage(
  buffer?: Buffer,
  filename = 'crop.png',
  mimeType = 'image/png',
  fields: Record<string, string> = {},
): Promise<Response> {
  const form = new FormData()
  if (buffer) {
    form.append('image', new Blob([buffer], { type: mimeType }), filename)
  }
  for (const [name, value] of Object.entries(fields)) {
    form.append(name, value)
  }
  return fetch(`${baseUrl}/api/images/segment`, {
    method: 'POST',
    body: form,
  })
}

test('normalizes a valid image and reports decoded dimensions', async () => {
  const result = await processUploadedImage(await createPng())

  assert.equal(result.mimeType, 'image/png')
  assert.equal(result.width, 8)
  assert.equal(result.height, 6)
  assert.ok(result.buffer.length > 0)
})

test('auto-rotates EXIF orientation and constrains large images', async () => {
  const orientedJpeg = await sharp({
    create: {
      width: 8,
      height: 4,
      channels: 3,
      background: { r: 45, g: 120, b: 55 },
    },
  })
    .jpeg()
    .withMetadata({ orientation: 6 })
    .toBuffer()
  const rotated = await processUploadedImage(orientedJpeg)
  assert.equal(rotated.width, 4)
  assert.equal(rotated.height, 8)

  const largeJpeg = await sharp({
    create: {
      width: 2200,
      height: 1600,
      channels: 3,
      background: { r: 45, g: 120, b: 55 },
    },
  })
    .jpeg()
    .toBuffer()
  const resized = await processUploadedImage(largeJpeg)
  assert.equal(resized.width, 2048)
  assert.ok(resized.height <= 2048)
  assert.ok(Math.abs(resized.width / resized.height - 2200 / 1600) < 0.002)
})

test('rejects invalid and unsupported image contents', async () => {
  await assert.rejects(
    processUploadedImage(Buffer.from('not an image')),
    ImageValidationError,
  )

  const unsupported = await sharp({
    create: {
      width: 2,
      height: 2,
      channels: 3,
      background: { r: 20, g: 20, b: 20 },
    },
  })
    .tiff()
    .toBuffer()
  await assert.rejects(
    processUploadedImage(unsupported),
    ImageValidationError,
  )
})

test('returns 400 when the multipart image is missing', async () => {
  const response = await postImage()

  assert.equal(response.status, 400)
  assert.match((await response.json()).error, /select/i)
})

test('accepts the language field before safely reporting missing model credentials', async () => {
  const originalKey = process.env.MODEL_API_KEY
  delete process.env.MODEL_API_KEY
  try {
    const response = await postImage(await createPng(), 'crop.png', 'image/png', {
      crop: 'rice',
      target: 'brown spots',
      language: 'en',
    })
    assert.equal(response.status, 503)
    assert.match((await response.json()).error, /not configured/i)
  } finally {
    if (originalKey !== undefined) {
      process.env.MODEL_API_KEY = originalKey
    }
  }
})

test('returns 400 for unsupported and corrupted uploads', async () => {
  const unsupported = await postImage(Buffer.from('plain text'), 'note.txt', 'text/plain')
  assert.equal(unsupported.status, 400)

  const corrupted = await postImage(
    Buffer.from('not a valid png'),
    'broken.png',
    'image/png',
  )
  assert.equal(corrupted.status, 400)
})

test('returns 413 for uploads above the five-megabyte limit', async () => {
  const oversized = await postImage(
    Buffer.alloc(5 * 1024 * 1024 + 1),
    'large.png',
  )
  assert.equal(oversized.status, 413)
  assert.match((await oversized.json()).error, /5 MB/i)
})
