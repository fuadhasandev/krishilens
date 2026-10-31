import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'
import type { SamAnalysis } from '../services/sam.js'
import { TemporaryStoreCapacityError } from './storeErrors.js'
import type { Crop, StoredScan } from './types.js'

const SCAN_TTL_MS = 2 * 60 * 60 * 1000
const MAX_ACTIVE_SCANS = 1_000

function hashAccessToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

function tokensMatch(expectedHash: string, token: string): boolean {
  const expected = Buffer.from(expectedHash, 'hex')
  const actual = Buffer.from(hashAccessToken(token), 'hex')
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

export interface ScanStore {
  create(
    crop: Crop,
    target: string,
    analysis: SamAnalysis,
  ): { scanId: string; accessToken: string }
  getAuthorized(scanId: string, accessToken: string): StoredScan | null
  get(scanId: string): StoredScan | null
}

export class InMemoryScanStore implements ScanStore {
  private readonly scans = new Map<string, StoredScan>()

  create(
    crop: Crop,
    target: string,
    analysis: SamAnalysis,
  ): { scanId: string; accessToken: string } {
    this.removeExpired()
    if (this.scans.size >= MAX_ACTIVE_SCANS) {
      throw new TemporaryStoreCapacityError()
    }
    const scanId = randomUUID()
    const accessToken = randomBytes(32).toString('base64url')
    const storedAnalysis: SamAnalysis = {
      ...analysis,
      overlay: { imageUrl: null },
    }

    this.scans.set(scanId, {
      id: scanId,
      accessTokenHash: hashAccessToken(accessToken),
      crop,
      target,
      analysis: storedAnalysis,
      createdAt: Date.now(),
      expiresAt: Date.now() + SCAN_TTL_MS,
    })

    return { scanId, accessToken }
  }

  getAuthorized(scanId: string, accessToken: string): StoredScan | null {
    this.removeExpired()
    const scan = this.scans.get(scanId)
    if (!scan || !tokensMatch(scan.accessTokenHash, accessToken)) {
      return null
    }
    return scan
  }

  get(scanId: string): StoredScan | null {
    this.removeExpired()
    return this.scans.get(scanId) ?? null
  }

  private removeExpired(): void {
    const now = Date.now()
    for (const [scanId, scan] of this.scans) {
      if (scan.expiresAt <= now) {
        this.scans.delete(scanId)
      }
    }
  }
}

export const scanStore: ScanStore = new InMemoryScanStore()
