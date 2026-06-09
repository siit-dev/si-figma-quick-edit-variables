import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  categoryForField,
  friendlyPropertyName,
  normalizeDiffValue,
  valuesEqual,
} from '../src/shared/diff'
import {
  nodeAtIndexPath,
  scanInstanceDiff,
  structuralIndexPath,
} from '../src/main/diff-scanner'

type MockNode = {
  id: string
  name: string
  type: string
  parent: MockNode | null
  children?: MockNode[]
  [key: string]: unknown
}

function node(
  id: string,
  type: string,
  name: string,
  children: MockNode[] = [],
  properties: Record<string, unknown> = {},
): MockNode {
  const value: MockNode = { id, type, name, parent: null, children, ...properties }
  for (const child of children) child.parent = value
  return value
}

describe('instance diff utilities', () => {
  it('categorizes fields and formats component property names', () => {
    expect(categoryForField('characters')).toBe('content')
    expect(categoryForField('fills')).toBe('appearance')
    expect(categoryForField('fontSize')).toBe('typography')
    expect(categoryForField('paddingLeft')).toBe('layout')
    expect(categoryForField('reactions')).toBe('prototype')
    expect(categoryForField('unknownFutureField')).toBe('other')
    expect(friendlyPropertyName('Button text#12:34')).toBe('Button text')
  })

  it('normalizes scalar, color, complex, and unavailable values', () => {
    expect(normalizeDiffValue(undefined).kind).toBe('unavailable')
    expect(normalizeDiffValue({ r: 1, g: 0, b: 0 }).preview).toBe('#FF0000')
    expect(normalizeDiffValue([{ type: 'SOLID' }]).preview).toBe('1 item')
    expect(valuesEqual({ b: 2, a: 1 }, { a: 1, b: 2 })).toBe(true)
  })

  it('maps matching structural child-index paths', () => {
    const target = node('target', 'TEXT', 'Label')
    const instance = node('instance', 'INSTANCE', 'Card', [
      node('wrapper', 'FRAME', 'Wrapper', [target]),
    ])
    const original = node('original', 'COMPONENT', 'Card', [
      node('original-wrapper', 'FRAME', 'Wrapper', [
        node('original-target', 'TEXT', 'Label'),
      ]),
    ])
    const path = structuralIndexPath(
      instance as unknown as Pick<SceneNode, 'id'>,
      target as unknown as SceneNode,
    )
    expect(path).toEqual([0, 0])
    expect(nodeAtIndexPath(original as unknown as SceneNode, path!)?.id).toBe(
      'original-target',
    )
  })
})

describe('instance diff scanner', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('discovers nested instances, maps values, and assigns overrides to the nearest owner', async () => {
    const originalNestedText = node('main-nested-text', 'TEXT', 'Nested label', [], {
      characters: 'Original',
    })
    const nestedMain = node('nested-main', 'COMPONENT', 'Nested component', [
      originalNestedText,
    ], {
      remote: false,
      componentPropertyDefinitions: {},
      variantProperties: null,
    })
    const topMain = node('top-main', 'COMPONENT', 'Top component', [], {
      remote: false,
      componentPropertyDefinitions: {},
      variantProperties: null,
    })

    const nestedText = node('nested-text', 'TEXT', 'Nested label', [], {
      characters: 'Changed',
    })
    const nestedInstance = node('nested-instance', 'INSTANCE', 'Nested instance', [
      nestedText,
    ], {
      overrides: [{ id: 'nested-text', overriddenFields: ['characters'] }],
      componentProperties: {},
      getMainComponentAsync: vi.fn(async () => nestedMain),
    })
    const topInstance = node('top-instance', 'INSTANCE', 'Top instance', [
      nestedInstance,
    ], {
      overrides: [{ id: 'nested-text', overriddenFields: ['characters'] }],
      componentProperties: {},
      getMainComponentAsync: vi.fn(async () => topMain),
    })
    const root = node('root', 'FRAME', 'Audit root', [topInstance])
    const all = new Map(
      [
        root,
        topInstance,
        nestedInstance,
        nestedText,
        topMain,
        nestedMain,
        originalNestedText,
      ].map((item) => [item.id, item]),
    )

    Object.assign(figma, {
      currentPage: { selection: [root] },
      getNodeByIdAsync: vi.fn(async (id: string) => all.get(id) ?? null),
    })

    const payload = await scanInstanceDiff()
    expect(payload.discoveredInstanceCount).toBe(2)
    expect(payload.unchangedInstanceCount).toBe(1)
    expect(payload.instances).toHaveLength(1)
    expect(payload.instances[0]?.instanceId).toBe('nested-instance')
    expect(payload.instances[0]?.layers[0]?.differences[0]).toMatchObject({
      field: 'characters',
      mapping: 'exact',
      original: { preview: 'Original' },
      current: { preview: 'Changed' },
    })
  })

  it('compares component properties even when Figma omits them from overrides', async () => {
    const componentSet = node('set', 'COMPONENT_SET', 'Button set', [], {
      componentPropertyDefinitions: {
        'Label#1:2': { type: 'TEXT', defaultValue: 'Submit' },
      },
    })
    const main = node('main', 'COMPONENT', 'Button', [], {
      remote: false,
      variantProperties: null,
      componentPropertyDefinitions: {},
    })
    main.parent = componentSet
    const instance = node('instance', 'INSTANCE', 'Button instance', [], {
      overrides: [],
      componentProperties: {
        'Label#1:2': { type: 'TEXT', value: 'Continue' },
      },
      getMainComponentAsync: vi.fn(async () => main),
    })
    const all = new Map([instance, main].map((item) => [item.id, item]))
    Object.assign(figma, {
      currentPage: { selection: [instance] },
      getNodeByIdAsync: vi.fn(async (id: string) => all.get(id) ?? null),
    })

    const payload = await scanInstanceDiff()
    expect(payload.instances[0]?.componentProperties[0]).toMatchObject({
      propertyName: 'Label',
      propertyType: 'TEXT',
      original: { preview: 'Submit' },
      current: { preview: 'Continue' },
    })
  })

  it('hides retained override records when original and current values match', async () => {
    const main = node('main', 'COMPONENT', 'State=Default', [], {
      remote: false,
      variantProperties: null,
      componentPropertyDefinitions: {},
    })
    const instance = node('instance', 'INSTANCE', 'State=Default', [], {
      overrides: [{ id: 'instance', overriddenFields: ['name'] }],
      componentProperties: {},
      getMainComponentAsync: vi.fn(async () => main),
    })
    const all = new Map([instance, main].map((item) => [item.id, item]))
    Object.assign(figma, {
      currentPage: { selection: [instance] },
      getNodeByIdAsync: vi.fn(async (id: string) => all.get(id) ?? null),
    })

    const payload = await scanInstanceDiff()
    expect(payload.instances).toHaveLength(0)
    expect(payload.unchangedInstanceCount).toBe(1)
  })
})
