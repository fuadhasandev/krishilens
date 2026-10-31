import 'dotenv/config'

function parsePort(value: string | undefined): number {
  if (value === undefined) {
    return 3000
  }

  const port = Number(value)
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535.')
  }

  return port
}

export const env = {
  port: parsePort(process.env.PORT),
  clientUrl: process.env.CLIENT_URL ?? 'http://localhost:5173',
}
