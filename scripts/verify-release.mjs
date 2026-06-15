import { readFile } from 'node:fs/promises'

const manifest = JSON.parse(await readFile(new URL('../manifest.json', import.meta.url), 'utf8'))
const failures = []

if (manifest.name !== 'SmartImpact Figma Quick Edit Variables') {
  failures.push('manifest name does not match the canonical Community name')
}
if (!/^\d+$/.test(manifest.id)) {
  failures.push('manifest id is not the permanent numeric Figma plugin ID')
}
if (manifest.documentAccess !== 'dynamic-page') {
  failures.push('documentAccess must remain dynamic-page')
}
if (
  !manifest.networkAccess ||
  manifest.networkAccess.allowedDomains?.length !== 1 ||
  manifest.networkAccess.allowedDomains[0] !== 'none'
) {
  failures.push('network access must remain disabled')
}

if (failures.length) {
  console.error(`Release check failed:\n- ${failures.join('\n- ')}`)
  process.exit(1)
}

console.log('Release manifest check passed.')
