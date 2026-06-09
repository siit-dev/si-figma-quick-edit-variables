import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const bundlePath = resolve(import.meta.dirname, '..', 'dist', 'code.js')
const bundle = await readFile(bundlePath, 'utf8')
const unsupportedTokens = ['?.', '??']
const found = unsupportedTokens.filter((token) => bundle.includes(token))

if (found.length > 0) {
  throw new Error(
    `Figma sandbox bundle contains unsupported syntax: ${found.join(', ')}`,
  )
}
