import { rename, rm } from 'node:fs/promises'
import { resolve } from 'node:path'

const dist = resolve(import.meta.dirname, '..', 'dist')
await rm(resolve(dist, 'ui.html'), { force: true })
await rename(resolve(dist, 'index.html'), resolve(dist, 'ui.html'))

