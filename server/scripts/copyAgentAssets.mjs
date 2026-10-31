import { copyFile, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const scriptDirectory = new URL('.', import.meta.url)
const source = new URL('../src/agent/systemPrompt.md', scriptDirectory)
const destinationDirectory = new URL('../dist/agent/', scriptDirectory)

await mkdir(destinationDirectory, { recursive: true })
await copyFile(
  fileURLToPath(source),
  fileURLToPath(new URL('systemPrompt.md', destinationDirectory)),
)
