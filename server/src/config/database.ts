import mongoose from 'mongoose'

let connection: Promise<typeof mongoose> | undefined

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
  }).catch((error: unknown) => {
    connection = undefined
    const reason = error instanceof Error ? error.name : 'UnknownError'
    throw new Error(`MongoDB connection failed (${reason}). Check MONGODB_URI and database access.`)
  })

  return connection
}

export async function disconnectDatabase(): Promise<void> {
  connection = undefined
  await mongoose.disconnect()
}
