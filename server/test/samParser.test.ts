import assert from 'node:assert/strict'
import test from 'node:test'
import {
  decodeMaskToRaster,
  parseImageStream,
  recordsOfKind,
  type ResponsesEvent,
} from '@meta-sam/parser'
import sharp from 'sharp'
import { renderSegmentationOverlay } from '../src/services/sam.js'

const output =
  '<0f>0<|box;x1=211;y1=228;x2=270;y2=254;w=320;h=334|>' +
  "<|mask;x=0;y=0;data=27,60,~!!!!M!0c[0o91w?q1!pIH4pPRVp2B3'7`e.ioeAf6-k/#Xd8%dX9x(|>"

async function* responseEvents(): AsyncIterable<ResponsesEvent> {
  yield {
    type: 'response.output_text.delta',
    item_id: 'message-1',
    output_index: 0,
    content_index: 0,
    delta: output,
  }
  yield {
    type: 'response.output_text.done',
    item_id: 'message-1',
    output_index: 0,
    content_index: 0,
    text: output,
  }
  yield { type: 'response.completed' }
}

test('parses documented SAM records and decodes the mask raster', async () => {
  const result = await parseImageStream(responseEvents()).finalResult
  const [box] = recordsOfKind(result.records, 'box')
  const [mask] = recordsOfKind(result.records, 'mask')

  assert.equal(result.outcome.status, 'completed')
  assert.equal(box?.objectId, '0')
  assert.deepEqual(mask?.bounds, {
    left: 211,
    top: 228,
    right: 271,
    bottom: 255,
  })
  assert.equal(mask ? decodeMaskToRaster(mask.mask).length : 0, 27 * 60)
})

test('renders mask-derived overlay with source dimensions and candidate pixels', async () => {
  const width = 4
  const height = 2
  const leaf = {
    width,
    height,
    pixels: Uint8Array.from([1, 1, 0, 0, 1, 1, 0, 0]),
  }
  const affected = {
    width,
    height,
    pixels: Uint8Array.from([0, 0, 1, 0, 0, 1, 1, 0]),
  }
  const url = await renderSegmentationOverlay(
    width,
    height,
    leaf.pixels,
    affected.pixels,
  )
  const png = Buffer.from(url.split(',')[1]!, 'base64')
  const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true })

  assert.equal(info.width, width)
  assert.equal(info.height, height)
  assert.equal(info.channels, 4)
  let orangePixels = 0
  let greenPixels = 0
  for (let index = 0; index < data.length; index += info.channels) {
    if (data[index] === 242 && data[index + 1] === 112) {
      orangePixels += 1
    }
    if (data[index] === 32 && data[index + 1] === 160) {
      greenPixels += 1
    }
  }
  assert.equal(orangePixels, 3)
  assert.ok(greenPixels > 0)
})
