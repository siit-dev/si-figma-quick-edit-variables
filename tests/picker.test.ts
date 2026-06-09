import { describe, expect, it } from 'vitest'
import { isPickerEligible, requiredScopes } from '../src/shared/picker'
import type { VariableSummary } from '../src/shared/types'

const variable: VariableSummary = {
  id: 'v1',
  name: 'spacing/md',
  collectionId: 'c1',
  collectionName: 'Tokens',
  resolvedType: 'FLOAT',
  remote: false,
  scopes: ['GAP'],
  groupPath: 'spacing',
  valuePreview: '16',
  excluded: false,
}

describe('picker policy', () => {
  it('requires compatible types and scopes', () => {
    const locator = { kind: 'node-field' as const, field: 'itemSpacing' }
    expect(requiredScopes(locator)).toContain('GAP')
    expect(isPickerEligible(variable, 'FLOAT', locator)).toBe(true)
    expect(isPickerEligible(variable, 'COLOR', locator)).toBe(false)
    expect(
      isPickerEligible({ ...variable, scopes: ['WIDTH_HEIGHT'] }, 'FLOAT', locator),
    ).toBe(false)
  })

  it('rejects excluded and remote variables', () => {
    const locator = { kind: 'node-field' as const, field: 'itemSpacing' }
    expect(isPickerEligible({ ...variable, excluded: true }, 'FLOAT', locator)).toBe(false)
    expect(isPickerEligible({ ...variable, remote: true }, 'FLOAT', locator)).toBe(false)
  })
})
