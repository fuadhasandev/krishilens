import type { AgentSession, TraceEntry } from './types.js'

export function recordTrace(
  session: AgentSession,
  entry: Omit<TraceEntry, 'step' | 'timestamp'>,
): void {
  session.trace.push({
    ...entry,
    step: session.trace.length + 1,
    timestamp: new Date().toISOString(),
  })
}
