import mongoose from 'mongoose'

let connection: Promise<typeof mongoose> | undefined

interface ErrorEvidence {
  path: string
  name: string
  code?: string | number
  category: string
}

function messageCategory(message: string): string {
  if (/authentication failed|auth failed|not authorized/i.test(message)) {
    return 'authentication'
  }
  if (/tls|ssl|certificate|handshake/i.test(message)) return 'tls'
  if (/ENOTFOUND|EAI_AGAIN|DNS|resolve/i.test(message)) return 'dns'
  if (/ETIMEDOUT|timed out|timeout/i.test(message)) return 'timeout'
  if (/connection string|URI|parse|invalid host/i.test(message)) {
    return 'connection_string'
  }
  if (/ECONNREFUSED|ECONNRESET|EHOSTUNREACH|ENETUNREACH/i.test(message)) {
    return 'network'
  }
  if (/network|socket|connect/i.test(message)) return 'network'
  return 'other'
}

export function summarizeMongoError(error: unknown): {
  category: string
  nestedErrors: ErrorEvidence[]
} {
  const nestedErrors: ErrorEvidence[] = []
  const seen = new Set<object>()
  const queue: Array<{ value: unknown; path: string; depth: number }> = [
    { value: error, path: 'root', depth: 0 },
  ]

  while (queue.length > 0 && nestedErrors.length < 60) {
    const current = queue.shift()
    if (!current) break
    const { value } = current
    if (
      !value ||
      (typeof value !== 'object' && typeof value !== 'function') ||
      seen.has(value) ||
      current.depth > 8
    ) {
      continue
    }

    seen.add(value)
    const item = value as {
      name?: unknown
      code?: unknown
      message?: unknown
      cause?: unknown
      reason?: unknown
      error?: unknown
      originalError?: unknown
      lastError?: unknown
      errorResponse?: unknown
      errors?: unknown
      servers?: unknown
    }
    const name =
      typeof item.name === 'string'
        ? item.name.slice(0, 100)
        : value.constructor?.name ?? 'Error'
    const code =
      typeof item.code === 'number'
        ? item.code
        : typeof item.code === 'string' &&
            /^[A-Za-z0-9_-]{1,80}$/.test(item.code)
          ? item.code
          : undefined
    const category =
      typeof item.message === 'string'
        ? messageCategory(item.message)
        : 'other'

    nestedErrors.push({
      path: current.path,
      name,
      ...(code !== undefined ? { code } : {}),
      category,
    })

    for (const key of [
      'cause',
      'reason',
      'error',
      'originalError',
      'lastError',
      'errorResponse',
    ] as const) {
      if (item[key]) {
        queue.push({
          value: item[key],
          path: `${current.path}.${key}`,
          depth: current.depth + 1,
        })
      }
    }

    for (const key of ['errors', 'servers'] as const) {
      const collection = item[key]
      if (collection instanceof Map) {
        for (const nested of collection.values()) {
          queue.push({
            value: nested,
            path: `${current.path}.${key}[]`,
            depth: current.depth + 1,
          })
        }
      } else if (Array.isArray(collection)) {
        for (const nested of collection) {
          queue.push({
            value: nested,
            path: `${current.path}.${key}[]`,
            depth: current.depth + 1,
          })
        }
      }
    }
  }

  const categories = nestedErrors.map((entry) => entry.category)
  const codes = nestedErrors.map((entry) => entry.code)
  const names = nestedErrors.map((entry) => entry.name)
  let category = 'unknown'

  if (
    codes.some((code) =>
      [18, 8000, 'AuthenticationFailed', 'AtlasError'].includes(code ?? ''),
    ) ||
    categories.includes('authentication')
  ) {
    category = 'authentication'
  } else if (
    categories.includes('connection_string') ||
    names.some((name) => /MongoParseError|ConnectionString/i.test(name))
  ) {
    category = 'connection_string'
  } else if (
    codes.some(
      (code) =>
        typeof code === 'string' &&
        /^(ERR_TLS|CERT|UNABLE_TO_VERIFY|SELF_SIGNED)/.test(code),
    ) ||
    categories.includes('tls')
  ) {
    category = 'tls'
  } else if (
    codes.some(
      (code) =>
        typeof code === 'string' &&
        /^(ENOTFOUND|EAI_AGAIN|ENODATA)$/.test(code),
    ) ||
    categories.includes('dns')
  ) {
    category = 'dns'
  } else if (
    codes.some(
      (code) =>
        typeof code === 'string' &&
        /^(ECONNREFUSED|ECONNRESET|EHOSTUNREACH|ENETUNREACH)$/.test(code),
    ) ||
    categories.includes('network')
  ) {
    category = 'network_or_allowlist'
  } else if (
    categories.includes('timeout') ||
    names.some((name) => /ServerSelection/i.test(name))
  ) {
    category = 'timeout_or_firewall_allowlist'
  }

  return { category, nestedErrors }
}

export async function connectDatabase(
  uri = process.env.MONGODB_URI?.trim(),
): Promise<typeof mongoose> {
  if (!uri) {
    throw new Error(
      'MongoDB is not configured. Set MONGODB_URI before starting the API.',
    )
  }

  if (mongoose.connection.readyState === 1) {
    return mongoose
  }

  connection ??= mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10_000,
    maxPoolSize: 10,
    minPoolSize: 0,
  }).catch((error: unknown) => {
    connection = undefined
    const diagnostics = summarizeMongoError(error)
    console.error('MongoDB connection failed; sanitized diagnostics:', diagnostics)
    throw new Error(
      `MongoDB connection failed (${diagnostics.category}). Check MONGODB_URI, network access, and database credentials.`,
    )
  })

  return connection
}

export async function disconnectDatabase(): Promise<void> {
  connection = undefined
  await mongoose.disconnect()
}
