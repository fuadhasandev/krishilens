import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'
import { TemporaryStoreCapacityError } from './storeErrors.js'
import type { AgentSession } from './types.js'

const SESSION_TTL_MS = 2 * 60 * 60 * 1000
const MAX_ACTIVE_SESSIONS = 1_000

function hashAccessToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

function tokensMatch(expectedHash: string, token: string): boolean {
  const expected = Buffer.from(expectedHash, 'hex')
  const actual = Buffer.from(hashAccessToken(token), 'hex')
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

export interface SessionStore {
  create(
    input: Omit<
      AgentSession,
      'id' | 'accessTokenHash' | 'createdAt' | 'updatedAt' | 'expiresAt'
    >,
  ): { session: AgentSession; accessToken: string }
  getAuthorized(sessionId: string, accessToken: string): AgentSession | null
  save(session: AgentSession): void
}

export class InMemorySessionStore implements SessionStore {
  private readonly sessions = new Map<string, AgentSession>()

  create(
    input: Omit<
      AgentSession,
      'id' | 'accessTokenHash' | 'createdAt' | 'updatedAt' | 'expiresAt'
    >,
  ): { session: AgentSession; accessToken: string } {
    this.removeExpired()
    if (this.sessions.size >= MAX_ACTIVE_SESSIONS) {
      throw new TemporaryStoreCapacityError()
    }
    const now = Date.now()
    const accessToken = randomBytes(32).toString('base64url')
    const session: AgentSession = {
      ...input,
      id: randomUUID(),
      accessTokenHash: hashAccessToken(accessToken),
      createdAt: now,
      updatedAt: now,
      expiresAt: now + SESSION_TTL_MS,
    }
    this.sessions.set(session.id, session)
    return { session, accessToken }
  }

  getAuthorized(sessionId: string, accessToken: string): AgentSession | null {
    this.removeExpired()
    const session = this.sessions.get(sessionId)
    if (!session || !tokensMatch(session.accessTokenHash, accessToken)) {
      return null
    }
    return session
  }

  save(session: AgentSession): void {
    session.updatedAt = Date.now()
    this.sessions.set(session.id, session)
  }

  private removeExpired(): void {
    const now = Date.now()
    for (const [sessionId, session] of this.sessions) {
      if (session.expiresAt <= now) {
        this.sessions.delete(sessionId)
      }
    }
  }
}

export const sessionStore: SessionStore = new InMemorySessionStore()
