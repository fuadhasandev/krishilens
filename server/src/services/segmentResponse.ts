import type { SamAnalysis } from './sam.js'

const MAX_SEGMENT_RESPONSE_BYTES = 4 * 1024 * 1024

export interface SegmentResponse extends SamAnalysis {
  scanId: string
  scanAccessToken: string
  responseTruncated?: boolean
}

export function fitSegmentResponse(
  response: SegmentResponse,
): SegmentResponse {
  if (Buffer.byteLength(JSON.stringify(response)) <= MAX_SEGMENT_RESPONSE_BYTES) {
    return response
  }

  const compactResponse: SegmentResponse = {
    ...response,
    overlay: { imageUrl: null },
    objects: [],
    warning: response.warning?.slice(0, 1000),
    requestIds: response.requestIds.slice(0, 10),
    responseTruncated: true,
  }

  if (Buffer.byteLength(JSON.stringify(compactResponse)) > MAX_SEGMENT_RESPONSE_BYTES) {
    throw new Error('The compacted segmentation response exceeds the API size limit.')
  }
  return compactResponse
}
