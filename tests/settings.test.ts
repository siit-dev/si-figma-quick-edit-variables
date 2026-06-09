import { describe, expect, it } from 'vitest'
import {
  getVariableGroupPath,
  isVariableExcluded,
  migrateSettings,
  normalizeGroupPath,
} from '../src/shared/settings'

describe('shared exclusion settings', () => {
  it('normalizes slash-delimited groups', () => {
    expect(normalizeGroupPath(' tokens / colors// deprecated ')).toBe(
      'tokens/colors/deprecated',
    )
    expect(getVariableGroupPath('tokens/colors/primary')).toBe('tokens/colors')
  })

  it('matches excluded groups by prefix and descendants', () => {
    const settings = migrateSettings({
      version: 1,
      excludedCollectionIds: [],
      excludedGroups: [{ collectionId: 'colors', prefix: 'tokens/colors' }],
    })

    expect(
      isVariableExcluded(
        {
          collectionId: 'colors',
          groupPath: 'tokens/colors/deprecated',
        },
        settings,
      ),
    ).toBe(true)
    expect(
      isVariableExcluded(
        {
          collectionId: 'colors',
          groupPath: 'tokens/text',
        },
        settings,
      ),
    ).toBe(false)
  })

  it('deduplicates and preserves unmatched rules', () => {
    expect(
      migrateSettings({
        version: 1,
        excludedCollectionIds: ['a', 'a'],
        excludedGroups: [
          { collectionId: 'a', prefix: 'old/group' },
          { collectionId: 'a', prefix: 'old/group/' },
        ],
      }),
    ).toEqual({
      version: 1,
      excludedCollectionIds: ['a'],
      excludedGroups: [{ collectionId: 'a', prefix: 'old/group' }],
    })
  })
})
