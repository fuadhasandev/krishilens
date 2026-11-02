import { config } from 'dotenv'
import { readFile, unlink } from 'node:fs/promises'
import { dirname, resolve, sep } from 'node:path'

config({ path: resolve(process.cwd(), '.env.e2e'), override: true })

async function main(): Promise<void> {
  const requestedPath = process.argv[2]
  if (!requestedPath) {
    throw new Error('Usage: npm run test:e2e:cleanup -- .e2e-runs/<run-id>.json')
  }

  const manifestDirectory = resolve(process.cwd(), '.e2e-runs')
  const manifestPath = resolve(process.cwd(), requestedPath)
  if (!manifestPath.startsWith(`${manifestDirectory}${sep}`)) {
    throw new Error('Cleanup manifests must be inside server/.e2e-runs.')
  }

  let contents: string
  try {
    contents = await readFile(manifestPath, 'utf8')
  } catch {
    throw new Error('The requested E2E cleanup manifest could not be read.')
  }

  let rawManifest: unknown
  try {
    rawManifest = JSON.parse(contents)
  } catch {
    throw new Error('The requested E2E cleanup manifest is invalid.')
  }

  const isolation = await import('../src/services/e2eIsolation.js')
  const manifest = isolation.parseE2eRunManifest(rawManifest)
  if (
    dirname(manifestPath) !== manifestDirectory ||
    manifestPath !== resolve(manifestDirectory, `${manifest.runId}.json`)
  ) {
    throw new Error('The cleanup manifest filename does not match its E2E run.')
  }
  const configuration = isolation.readE2eConfiguration(false)
  const result = await isolation.cleanupE2eRun(manifest, configuration)
  await unlink(manifestPath)
  console.info(
    `E2E cleanup verified: ${result.deletedAssets} private image asset(s) and the dedicated database were removed.`,
  )
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown cleanup failure.'
  console.error(`E2E cleanup incomplete: ${message}`)
  process.exitCode = 1
})
