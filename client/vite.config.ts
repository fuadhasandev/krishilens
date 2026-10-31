import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'

export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, process.cwd(), 'VITE_')
  const apiUrl = environment.VITE_API_URL?.trim()

  if (mode === 'production') {
    let parsedApiUrl: URL | undefined
    try {
      parsedApiUrl = apiUrl ? new URL(apiUrl) : undefined
    } catch {
      parsedApiUrl = undefined
    }

    if (
      !parsedApiUrl ||
      parsedApiUrl.protocol !== 'https:' ||
      parsedApiUrl.origin !== apiUrl?.replace(/\/$/, '')
    ) {
      throw new Error(
        'Production builds require VITE_API_URL to be an HTTPS backend origin.',
      )
    }
  }

  return {
    plugins: [react(), tailwindcss()],
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      testTimeout: 20_000,
    },
  }
})
