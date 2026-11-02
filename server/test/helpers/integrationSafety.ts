const allowedDatabaseName =
  /^krishilens_(?:e2e_[0-9a-f]{32}|integration_test(?:_[a-z0-9-]+)?)$/i

export function assertDisposableIntegrationDatabase(): void {
  const uri = process.env.MONGODB_URI?.trim()
  let databaseName = ''
  try {
    databaseName = decodeURIComponent(new URL(uri ?? '').pathname.slice(1))
  } catch {
    throw new Error('Integration tests require a valid dedicated MongoDB test URI.')
  }
  if (!allowedDatabaseName.test(databaseName)) {
    throw new Error(
      'Refusing live integration tests outside a krishilens_e2e_* or krishilens_integration_test database.',
    )
  }
}

export function assertDedicatedCloudinaryConfirmation(): void {
  if (
    process.env.E2E_CLOUDINARY_CONFIRMATION !==
    'I_HAVE_CONFIGURED_A_DISPOSABLE_CLOUDINARY_ACCOUNT'
  ) {
    throw new Error('Cloudinary integration tests require a dedicated disposable account confirmation.')
  }
}
