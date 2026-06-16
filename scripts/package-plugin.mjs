import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, resolve } from 'node:path'
import { spawn } from 'node:child_process'
import { zipSync } from 'fflate'

const root = resolve(import.meta.dirname, '..')
const packageJson = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'))
const version = packageJson.version
const archiveName = `smartimpact-figma-quick-edit-variables-v${version}.zip`
const releaseDir = resolve(root, 'release')
const archivePath = resolve(releaseDir, archiveName)
const stageDir = resolve(tmpdir(), `si-figma-plugin-package-${Date.now()}`)
const allowedFiles = ['manifest.json', 'dist/code.js', 'dist/ui.html']

async function run(command, args) {
  await new Promise((resolvePromise, reject) => {
    const isWindowsNpm = process.platform === 'win32' && command === 'npm'
    const executable = isWindowsNpm ? process.env.ComSpec : command
    const executableArgs = isWindowsNpm ? ['/d', '/s', '/c', command, ...args] : args
    const child = spawn(executable, executableArgs, {
      cwd: root,
      stdio: 'inherit',
    })

    child.on('exit', (code) => {
      if (code === 0) resolvePromise()
      else reject(new Error(`${command} ${args.join(' ')} failed with exit code ${code}`))
    })
    child.on('error', reject)
  })
}

await run('npm', ['run', 'clean'])
await run('npm', ['run', 'build'])
await run('npm', ['run', 'release:check'])

await rm(stageDir, { recursive: true, force: true })
await mkdir(stageDir, { recursive: true })

for (const relativePath of allowedFiles) {
  await mkdir(resolve(stageDir, relativePath, '..'), { recursive: true })
  await cp(resolve(root, relativePath), resolve(stageDir, relativePath), {
    force: true,
    recursive: false,
  })
}

const zipEntries = {}
for (const relativePath of allowedFiles) {
  zipEntries[relativePath] = new Uint8Array(await readFile(resolve(stageDir, relativePath)))
}

await mkdir(releaseDir, { recursive: true })
await writeFile(archivePath, zipSync(zipEntries, { level: 9 }))
await rm(stageDir, { recursive: true, force: true })

console.log(`Created ${basename(archivePath)} with:`)
for (const relativePath of allowedFiles) {
  console.log(`- ${relativePath}`)
}
