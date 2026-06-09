import { describe, expect, it, vi } from 'vitest'
import { nodeFieldAdapter } from '../src/main/adapters/node-field'
import { paintAdapter } from '../src/main/adapters/paint'

describe('binding adapters', () => {
  it('discovers scalar fields', () => {
    const setBoundVariable = vi.fn()
    const node = {
      boundVariables: {
        width: { type: 'VARIABLE_ALIAS', id: 'old' },
      },
      setBoundVariable,
    } as unknown as SceneNode

    expect(nodeFieldAdapter.scan(node)).toEqual([
      {
        locator: { kind: 'node-field', field: 'width' },
        alias: { type: 'VARIABLE_ALIAS', id: 'old' },
        propertyLabel: 'Width',
      },
    ])
    expect(setBoundVariable).not.toHaveBeenCalled()
  })

  it('discovers bound solid paints', () => {
    const node = {
      fills: [
        {
          type: 'SOLID',
          color: { r: 1, g: 0, b: 0 },
          boundVariables: { color: { type: 'VARIABLE_ALIAS', id: 'old' } },
        },
      ],
    } as unknown as SceneNode

    const found = paintAdapter.scan(node)
    expect(found).toHaveLength(1)
    expect(found[0]).toEqual({
      locator: { kind: 'paint', field: 'fills', index: 0, subfield: 'color' },
      alias: { type: 'VARIABLE_ALIAS', id: 'old' },
      propertyLabel: 'Fill 1 color',
    })
  })
})
