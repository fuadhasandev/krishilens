import { v2 as cloudinary } from 'cloudinary'
import mongoose from 'mongoose'

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const databasePrefix = 'krishilens_e2e_'

export interface E2eRunManifest {
  version: 1
  runId: string
  ownerId: string
  databaseName: string
}

export interface E2eConfiguration {
  baseMongoUri: string
  mongoHost: string
  modelApiKey: string
  cloudinaryCloudName: string
  cloudinaryApiKey: string
  cloudinaryApiSecret: string
}

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`Missing required disposable E2E setting: ${name}.`)
  }
  return value
}

export function readE2eConfiguration(requireModelKey = true): E2eConfiguration {
  if (
    process.env.E2E_DATABASE_CONFIRMATION !==
      'I_HAVE_CONFIGURED_A_DISPOSABLE_ATLAS_CLUSTER' ||
    process.env.E2E_CLOUDINARY_CONFIRMATION !==
      'I_HAVE_CONFIGURED_A_DISPOSABLE_CLOUDINARY_ACCOUNT'
  ) {
    throw new Error(
      'Confirm the dedicated disposable Atlas and Cloudinary environments before running or cleaning E2E resources.',
    )
  }

  const baseMongoUri = requiredEnvironment('E2E_MONGODB_URI')
  const mongoHost = requiredEnvironment('E2E_MONGODB_HOST')
  let parsedMongoUri: URL
  try {
    parsedMongoUri = new URL(baseMongoUri)
  } catch {
    throw new Error('E2E_MONGODB_URI must be a valid MongoDB connection URI.')
  }
  if (
    !['mongodb:', 'mongodb+srv:'].includes(parsedMongoUri.protocol) ||
    parsedMongoUri.hostname !== mongoHost
  ) {
    throw new Error('E2E_MONGODB_URI does not match the confirmed disposable MongoDB host.')
  }

  return {
    baseMongoUri,
    mongoHost,
    modelApiKey: requireModelKey
      ? requiredEnvironment('E2E_MODEL_API_KEY')
      : '',
    cloudinaryCloudName: requiredEnvironment('E2E_CLOUDINARY_CLOUD_NAME'),
    cloudinaryApiKey: requiredEnvironment('E2E_CLOUDINARY_API_KEY'),
    cloudinaryApiSecret: requiredEnvironment('E2E_CLOUDINARY_API_SECRET'),
  }
}

export function databaseNameForRun(runId: string): string {
  if (!uuidPattern.test(runId)) {
    throw new Error('Invalid E2E run identifier.')
  }
  return `${databasePrefix}${runId.replaceAll('-', '').toLowerCase()}`
}

export function databaseUriForRun(baseMongoUri: string, databaseName: string): string {
  if (!new RegExp(`^${databasePrefix}[0-9a-f]{32}$`).test(databaseName)) {
    throw new Error('Refusing to use a database outside the disposable E2E namespace.')
  }
  let uri: URL
  try {
    uri = new URL(baseMongoUri)
  } catch {
    throw new Error('E2E_MONGODB_URI must be a valid MongoDB connection URI.')
  }
  if (!['mongodb:', 'mongodb+srv:'].includes(uri.protocol)) {
    throw new Error('E2E_MONGODB_URI must use MongoDB.')
  }
  uri.pathname = `/${databaseName}`
  return uri.toString()
}

export function createE2eRunManifest(runId: string, ownerId: string): E2eRunManifest {
  if (!uuidPattern.test(ownerId)) {
    throw new Error('Invalid E2E owner identifier.')
  }
  return {
    version: 1,
    runId,
    ownerId,
    databaseName: databaseNameForRun(runId),
  }
}

export function parseE2eRunManifest(value: unknown): E2eRunManifest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid E2E cleanup manifest.')
  }
  const manifest = value as Partial<E2eRunManifest>
  const expectedDatabaseName =
    typeof manifest.runId === 'string'
      ? databaseNameForRun(manifest.runId)
      : ''
  if (
    manifest.version !== 1 ||
    typeof manifest.ownerId !== 'string' ||
    !uuidPattern.test(manifest.ownerId) ||
    manifest.databaseName !== expectedDatabaseName
  ) {
    throw new Error('Invalid E2E cleanup manifest; no resources were removed.')
  }
  return manifest as E2eRunManifest
}

export function publicIdBelongsToOwner(publicId: string, ownerId: string): boolean {
  if (!uuidPattern.test(ownerId)) return false
  return new RegExp(
    `^krishilens/${ownerId}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`,
    'i',
  ).test(publicId)
}

interface CloudinaryResource {
  public_id?: unknown
  resource_type?: unknown
  type?: unknown
}

interface CloudinaryResourcePage {
  resources?: unknown
  next_cursor?: unknown
}

async function listOwnerAssets(ownerId: string): Promise<string[]> {
  const prefix = `krishilens/${ownerId}/`
  const publicIds: string[] = []
  let nextCursor: string | undefined

  do {
    let page: CloudinaryResourcePage
    try {
      page = await cloudinary.api.resources({
        resource_type: 'image',
        type: 'authenticated',
        prefix,
        max_results: 500,
        ...(nextCursor ? { next_cursor: nextCursor } : {}),
      }) as CloudinaryResourcePage
    } catch {
      throw new Error('Cloudinary owner-scoped resource listing failed.')
    }

    if (!Array.isArray(page.resources)) {
      throw new Error('Cloudinary returned an invalid owner-scoped resource list.')
    }
    for (const value of page.resources) {
      if (!value || typeof value !== 'object') {
        throw new Error('Cloudinary returned an invalid owner-scoped resource.')
      }
      const resource = value as CloudinaryResource
      if (
        typeof resource.public_id !== 'string' ||
        !publicIdBelongsToOwner(resource.public_id, ownerId) ||
        resource.resource_type !== 'image' ||
        resource.type !== 'authenticated'
      ) {
        throw new Error(
          'Cloudinary returned a resource outside the exact disposable owner scope.',
        )
      }
      publicIds.push(resource.public_id)
    }
    if (page.next_cursor !== undefined && typeof page.next_cursor !== 'string') {
      throw new Error('Cloudinary returned an invalid pagination cursor.')
    }
    nextCursor = page.next_cursor || undefined
  } while (nextCursor)

  return publicIds
}

async function removeOwnerAssets(
  ownerId: string,
  publicIds: string[],
): Promise<number> {
  for (const publicId of publicIds) {
    try {
      const result = await cloudinary.uploader.destroy(publicId, {
        resource_type: 'image',
        type: 'authenticated',
        invalidate: true,
      })
      if (result.result !== 'ok' && result.result !== 'not found') {
        throw new Error('Cloudinary did not confirm asset deletion.')
      }
    } catch {
      throw new Error('Cloudinary cleanup is incomplete; the E2E database was retained.')
    }
  }

  const remaining = await listOwnerAssets(ownerId)
  if (remaining.length > 0) {
    throw new Error('Cloudinary cleanup is incomplete; the E2E database was retained.')
  }
  return publicIds.length
}

export async function cleanupE2eRun(
  manifest: E2eRunManifest,
  configuration: E2eConfiguration,
): Promise<{ deletedAssets: number; droppedDatabase: string }> {
  const safeManifest = parseE2eRunManifest(manifest)
  cloudinary.config({
    cloud_name: configuration.cloudinaryCloudName,
    api_key: configuration.cloudinaryApiKey,
    api_secret: configuration.cloudinaryApiSecret,
    secure: true,
  })

  const uri = databaseUriForRun(
    configuration.baseMongoUri,
    safeManifest.databaseName,
  )
  let connection: typeof mongoose.connection | undefined
  let databaseCleanupFailed = false
  let deletedAssets = 0
  try {
    connection = await mongoose.createConnection(uri, {
      serverSelectionTimeoutMS: 10_000,
      maxPoolSize: 2,
    }).asPromise()
    const database = connection.db
    if (!database) {
      throw new Error('E2E database connection did not expose a database handle.')
    }
    const ownerRecord = await database
      .collection('anonymousowners')
      .findOne({ ownerId: safeManifest.ownerId })
    const assets = await listOwnerAssets(safeManifest.ownerId)
    if (assets.length > 0 && !ownerRecord) {
      throw new Error('Cloudinary cleanup refused because the run owner is absent from its dedicated database.')
    }
    deletedAssets = await removeOwnerAssets(safeManifest.ownerId, assets)
    await connection.dropDatabase()
  } catch {
    databaseCleanupFailed = true
  }
  if (connection) {
    try {
      await connection.close()
    } catch {
      databaseCleanupFailed = true
    }
  }
  if (databaseCleanupFailed) {
    throw new Error('E2E cleanup was incomplete; retain the run manifest for a safe retry.')
  }
  return { deletedAssets, droppedDatabase: safeManifest.databaseName }
}
