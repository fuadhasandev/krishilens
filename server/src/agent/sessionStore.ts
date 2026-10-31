import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'
import { TemporaryStoreCapacityError } from './storeErrors.js'
import type { AgentSession } from './types.js'
import { InvestigationModel, TraceModel } from '../models/index.js'

const SESSION_TTL_MS = 2 * 60 * 60 * 1000
const MAX_ACTIVE_SESSIONS = 1_000
const PERSISTENT_SESSION_TTL_MS = 365 * 24 * 60 * 60 * 1000

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
  ): { session: AgentSession; accessToken: string } | Promise<{ session: AgentSession; accessToken: string }>
  getAuthorized(sessionId: string, accessToken: string): AgentSession | null | Promise<AgentSession | null>
  save(session: AgentSession): void | Promise<void>
}

export class SessionConflictError extends Error {
  constructor() {
    super('Investigation state changed before it could be saved.')
    this.name = 'SessionConflictError'
  }
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

export class MongoSessionStore implements SessionStore {
  async create(
    input: Omit<
      AgentSession,
      'id' | 'accessTokenHash' | 'createdAt' | 'updatedAt' | 'expiresAt'
    >,
  ): Promise<{ session: AgentSession; accessToken: string }> {
    const now = Date.now()
    const activeCount = await InvestigationModel.countDocuments({
      expiresAt: { $gt: new Date(now) },
      state: { $ne: null },
    })
    if (activeCount >= MAX_ACTIVE_SESSIONS) {
      throw new TemporaryStoreCapacityError()
    }

    const accessToken = randomBytes(32).toString('base64url')
    const session: AgentSession = {
      ...input,
      id: randomUUID(),
      accessTokenHash: hashAccessToken(accessToken),
      createdAt: now,
      updatedAt: now,
      expiresAt: now + PERSISTENT_SESSION_TTL_MS,
      storageVersion: 0,
    }
    await InvestigationModel.create({
      investigationId: session.id,
      caseId: session.id,
      ownerId: session.id,
      farmerQuestion: session.farmerQuestion,
      followUps: [],
      agentStatus: session.status,
      report: session.report ?? null,
      evidenceSourceIds: session.retrievedSourceIds,
      language: session.language,
      state: session,
      accessTokenHash: session.accessTokenHash,
      expiresAt: new Date(session.expiresAt),
      revision: 0,
    })
    return { session, accessToken }
  }

  async getAuthorized(sessionId: string, accessToken: string): Promise<AgentSession | null> {
    const record = await InvestigationModel.findOne({
      investigationId: sessionId,
      expiresAt: { $gt: new Date() },
      state: { $ne: null },
    })
      .select('+accessTokenHash')
      .lean()
    if (
      !record ||
      !record.state ||
      !record.accessTokenHash ||
      !tokensMatch(record.accessTokenHash, accessToken)
    ) {
      return null
    }
    return { ...record.state, storageVersion: record.revision }
  }

  async save(session: AgentSession): Promise<void> {
    const nextVersion = (session.storageVersion ?? 0) + 1
    session.updatedAt = Date.now()
    session.storageVersion = nextVersion
    let result
    try {
      result = await InvestigationModel.updateOne(
        {
          investigationId: session.id,
          accessTokenHash: session.accessTokenHash,
          revision: nextVersion - 1,
          expiresAt: { $gt: new Date() },
        },
        {
          $set: {
            state: session,
            agentStatus: session.status,
            report: session.report ?? null,
            evidenceSourceIds: session.retrievedSourceIds,
            updatedAt: new Date(session.updatedAt),
          },
          $inc: { revision: 1 },
        },
      )
    } catch (error) {
      session.storageVersion = nextVersion - 1
      throw error
    }
    if (result.modifiedCount !== 1) {
      session.storageVersion = nextVersion - 1
      throw new SessionConflictError()
    }

    await Promise.all(session.trace.map((entry) =>
      TraceModel.updateOne(
        { investigationId: session.id, step: entry.step },
        {
          $set: {
            caseId: session.id,
            toolName: entry.toolName,
            argumentsSummary: entry.summary.slice(0, 240),
            result: `${entry.status}${entry.error ? `: ${entry.error}` : ''}`.slice(0, 500),
            durationMs: entry.durationMs,
            timestamp: new Date(entry.timestamp),
          },
        },
        { upsert: true },
      ),
    ))
  }
}

export let sessionStore: SessionStore = new InMemorySessionStore()

export function useMongoSessionStore(): void {
  sessionStore = new MongoSessionStore()
}
