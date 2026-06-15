import { beforeEach, describe, expect, it, vi } from 'vitest'
import { normalizeDiffValue, valuesEqual } from '../src/shared/diff'
import {
  nodeAtIndexPath,
  scanInstanceDiff,
  structuralIndexPath,
} from '../src/main/diff-scanner'
import { geometryAdapter } from '../src/main/visual-diff/geometry'
import { appearanceAdapter } from '../src/main/visual-diff/appearance'
import { spacingAdapter } from '../src/main/visual-diff/spacing'
import { typographyAdapter } from '../src/main/visual-diff/typography'
import { VisualVariableResolver } from '../src/main/visual-diff/variable-resolver'

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
  const value: MockNode = {
    id,
    type,
    name,
    parent: null,
    children,
    visible: true,
    opacity: 1,
    blendMode: 'NORMAL',
    width: 100,
    height: 40,
    x: 0,
    y: 0,
    rotation: 0,
    fills: [],
    strokes: [],
    effects: [],
    boundVariables: {},
    resolvedVariableModes: {},
    ...properties,
  }
  for (const child of children) child.parent = value
  return value
}

function instance(
  id: string,
  name: string,
  main: MockNode,
  children: MockNode[] = [],
  properties: Record<string, unknown> = {},
) {
  return node(id, 'INSTANCE', name, children, {
    getMainComponentAsync: vi.fn(async () => main),
    ...properties,
  })
}

function installFigma(nodes: MockNode[]) {
  const all = new Map(nodes.map((item) => [item.id, item]))
  Object.assign(figma, {
    currentPage: { selection: [nodes[0]] },
    getNodeByIdAsync: vi.fn(async (id: string) => all.get(id) ?? null),
  })
}

describe('visual diff utilities', () => {
  it('normalizes useful values and strips binding metadata', () => {
    expect(normalizeDiffValue(undefined).kind).toBe('unavailable')
    expect(normalizeDiffValue({ r: 1, g: 0, b: 0 }).preview).toBe('#FF0000')
    expect(normalizeDiffValue(16, { unit: 'px' }).preview).toBe('16 px')
    expect(
      valuesEqual(
        { color: { r: 1, g: 0, b: 0 }, boundVariables: { color: { id: 'a' } } },
        { color: { r: 1, g: 0, b: 0 }, boundVariables: { color: { id: 'b' } } },
      ),
    ).toBe(true)
  })

  it('maps matching structural child-index paths', () => {
    const target = node('target', 'TEXT', 'Label')
    const current = node('instance', 'INSTANCE', 'Card', [
      node('wrapper', 'FRAME', 'Wrapper', [target]),
    ])
    const original = node('original', 'COMPONENT', 'Card', [
      node('original-wrapper', 'FRAME', 'Wrapper', [
        node('original-target', 'TEXT', 'Label'),
      ]),
    ])
    const path = structuralIndexPath(
      current as unknown as Pick<SceneNode, 'id'>,
      target as unknown as SceneNode,
    )
    expect(path).toEqual([0, 0])
    expect(nodeAtIndexPath(original as unknown as SceneNode, path!)?.id).toBe(
      'original-target',
    )
  })

  it('suppresses text auto-size and auto-layout flow positions', () => {
    const parent = node('parent', 'FRAME', 'Row', [], { layoutMode: 'HORIZONTAL' })
    const text = node('text', 'TEXT', 'Label', [], {
      textAutoResize: 'WIDTH_AND_HEIGHT',
      x: 40,
      y: 20,
    })
    text.parent = parent
    const fields = geometryAdapter
      .extract(text as unknown as SceneNode)
      .map((property) => property.field)
    expect(fields).not.toContain('width')
    expect(fields).not.toContain('height')
    expect(fields).not.toContain('x')
    expect(fields).not.toContain('y')
  })

  it('extracts appearance, spacing, and typography property families', () => {
    const frame = node('frame', 'FRAME', 'Card', [], {
      layoutMode: 'VERTICAL',
      paddingLeft: 16,
      paddingRight: 16,
      paddingTop: 12,
      paddingBottom: 12,
      itemSpacing: 8,
      counterAxisSpacing: 0,
      cornerRadius: 12,
      fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0 } }],
      effects: [
        {
          type: 'DROP_SHADOW',
          color: { r: 0, g: 0, b: 0, a: 0.2 },
          offset: { x: 0, y: 4 },
          radius: 12,
          spread: 0,
          visible: true,
          blendMode: 'NORMAL',
        },
      ],
    })
    const text = node('text', 'TEXT', 'Label', [], {
      textAlignHorizontal: 'CENTER',
      textAlignVertical: 'CENTER',
      getStyledTextSegments: vi.fn(() => [
        {
          fontName: { family: 'Inter', style: 'Semi Bold' },
          fontSize: 16,
          fontWeight: 600,
          lineHeight: { unit: 'PIXELS', value: 24 },
          letterSpacing: { unit: 'PIXELS', value: 0 },
          paragraphIndent: 0,
          paragraphSpacing: 0,
          textCase: 'ORIGINAL',
          textDecoration: 'NONE',
          boundVariables: {},
        },
      ]),
    })
    expect(
      appearanceAdapter.extract(frame as unknown as SceneNode).map((item) => item.field),
    ).toEqual(expect.arrayContaining(['fills', 'effects', 'cornerRadius']))
    expect(
      spacingAdapter.extract(frame as unknown as SceneNode).map((item) => item.field),
    ).toEqual(expect.arrayContaining(['paddingLeft', 'itemSpacing']))
    expect(
      typographyAdapter.extract(text as unknown as SceneNode).map((item) => item.field),
    ).toEqual(
      expect.arrayContaining(['fontName', 'fontSize', 'lineHeight', 'textAlignHorizontal']),
    )
  })
})

describe('visual instance scanner', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    Object.assign(figma.variables, {
      getVariableByIdAsync: vi.fn(async () => null),
      getVariableCollectionByIdAsync: vi.fn(async () => null),
    })
  })

  it('reports visual styles but ignores text content and derived text width', async () => {
    const originalText = node('original-text', 'TEXT', 'Label', [], {
      characters: 'Original',
      width: 60,
      textAutoResize: 'WIDTH_AND_HEIGHT',
      fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }],
      getStyledTextSegments: vi.fn(() => [
        {
          fontName: { family: 'Inter', style: 'Regular' },
          fontSize: 14,
          fontWeight: 400,
          lineHeight: { unit: 'AUTO' },
          letterSpacing: { unit: 'PIXELS', value: 0 },
          paragraphIndent: 0,
          paragraphSpacing: 0,
          textCase: 'ORIGINAL',
          textDecoration: 'NONE',
          boundVariables: {},
        },
      ]),
      textAlignHorizontal: 'LEFT',
      textAlignVertical: 'TOP',
    })
    const main = node('main', 'COMPONENT', 'State=Default', [originalText], {
      remote: false,
    })
    const currentText = node('current-text', 'TEXT', 'Label', [], {
      characters: 'Changed content',
      width: 120,
      textAutoResize: 'WIDTH_AND_HEIGHT',
      fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0 } }],
      getStyledTextSegments: originalText.getStyledTextSegments,
      textAlignHorizontal: 'LEFT',
      textAlignVertical: 'TOP',
    })
    const current = instance('current', 'State=Default', main, [currentText])
    installFigma([current, currentText, main, originalText])

    const payload = await scanInstanceDiff()
    const differences = payload.instances[0]?.layers.flatMap(
      (layer) => layer.differences,
    )
    expect(differences).toHaveLength(1)
    expect(differences?.[0]).toMatchObject({
      field: 'fills',
      category: 'appearance',
      original: { preview: '#000000' },
      current: { preview: '#FF0000' },
    })
  })

  it('uses the exact current main variant instead of a default variant', async () => {
    const emphasis = node('emphasis', 'COMPONENT', 'State=Emphasis', [], {
      remote: false,
      fills: [{ type: 'SOLID', color: { r: 1, g: 0.3, b: 0.1 } }],
    })
    const current = instance('current', 'State=Emphasis', emphasis, [], {
      fills: [{ type: 'SOLID', color: { r: 1, g: 0.3, b: 0.1 } }],
    })
    installFigma([current, emphasis])

    const payload = await scanInstanceDiff()
    expect(current.getMainComponentAsync).toHaveBeenCalled()
    expect(payload.instances).toHaveLength(0)
  })

  it('ignores hidden subtrees and reports only a visibility transition', async () => {
    const originalChild = node('original-child', 'RECTANGLE', 'Badge', [], {
      visible: false,
      fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 1 } }],
    })
    const main = node('main', 'COMPONENT', 'Card', [originalChild], { remote: false })
    const currentChild = node('current-child', 'RECTANGLE', 'Badge', [], {
      visible: false,
      fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0 } }],
    })
    const current = instance('current', 'Card', main, [currentChild])
    installFigma([current, currentChild, main, originalChild])

    expect((await scanInstanceDiff()).instances).toHaveLength(0)

    currentChild.visible = true
    const payload = await scanInstanceDiff()
    expect(payload.instances[0]?.differenceCount).toBe(1)
    expect(payload.instances[0]?.layers[0]?.differences[0]).toMatchObject({
      field: 'visible',
      category: 'visibility',
    })
  })

  it('does not discover nested instances inside hidden subtrees', async () => {
    const nestedMain = node('nested-main', 'COMPONENT', 'Icon', [], { remote: false })
    const originalNested = instance('original-nested', 'Icon', nestedMain, [], {
      visible: false,
    })
    const topMain = node('top-main', 'COMPONENT', 'Card', [originalNested], {
      remote: false,
    })
    const currentNested = instance('current-nested', 'Icon', nestedMain, [], {
      visible: false,
    })
    const topCurrent = instance('top-current', 'Card', topMain, [currentNested])
    installFigma([
      topCurrent,
      currentNested,
      topMain,
      originalNested,
      nestedMain,
    ])

    const payload = await scanInstanceDiff()
    expect(payload.discoveredInstanceCount).toBe(1)
    expect(payload.instances).toHaveLength(0)
  })

  it('assigns internal changes to the nearest nested instance', async () => {
    const nestedOriginalChild = node('nested-original-child', 'RECTANGLE', 'Icon', [], {
      fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 1 } }],
    })
    const nestedMain = node('nested-main', 'COMPONENT', 'Icon', [nestedOriginalChild], {
      remote: false,
    })
    const originalNested = instance('original-nested', 'Nested icon', nestedMain)
    const topMain = node('top-main', 'COMPONENT', 'Card', [originalNested], {
      remote: false,
    })
    const nestedCurrentChild = node('nested-current-child', 'RECTANGLE', 'Icon', [], {
      fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0 } }],
    })
    const nestedCurrent = instance(
      'nested-current',
      'Nested icon',
      nestedMain,
      [nestedCurrentChild],
    )
    const topCurrent = instance('top-current', 'Card', topMain, [nestedCurrent])
    installFigma([
      topCurrent,
      nestedCurrent,
      nestedCurrentChild,
      topMain,
      originalNested,
      nestedMain,
      nestedOriginalChild,
    ])

    const payload = await scanInstanceDiff()
    expect(payload.discoveredInstanceCount).toBe(2)
    expect(payload.instances).toHaveLength(1)
    expect(payload.instances[0]?.instanceId).toBe('nested-current')
    expect(payload.instances[0]?.layers[0]?.differences[0]?.field).toBe('fills')
  })

  it('reports unmatched visible layers as structural changes', async () => {
    const main = node('main', 'COMPONENT', 'Card', [], { remote: false })
    const added = node('added', 'RECTANGLE', 'Badge')
    const current = instance('current', 'Card', main, [added])
    installFigma([current, added, main])

    const payload = await scanInstanceDiff()
    expect(payload.instances[0]?.layers[0]?.differences[0]).toMatchObject({
      category: 'structure',
      label: 'Added visible layer',
    })
  })

  it('does not diff identical rendered paints with different aliases', async () => {
    const originalPaint = {
      type: 'SOLID',
      color: { r: 0, g: 0.5, b: 1 },
      boundVariables: { color: { type: 'VARIABLE_ALIAS', id: 'original-token' } },
    }
    const currentPaint = {
      type: 'SOLID',
      color: { r: 0, g: 0.5, b: 1 },
      boundVariables: { color: { type: 'VARIABLE_ALIAS', id: 'current-token' } },
    }
    const main = node('main', 'COMPONENT', 'Card', [], {
      remote: false,
      fills: [originalPaint],
    })
    const current = instance('current', 'Card', main, [], { fills: [currentPaint] })
    installFigma([current, main])

    expect((await scanInstanceDiff()).instances).toHaveLength(0)
    expect(figma.variables.getVariableByIdAsync).not.toHaveBeenCalled()
  })
})

describe('visual variable resolver', () => {
  it('resolves remote multi-hop aliases with consumer modes and readable provenance', async () => {
    const collections = new Map([
      [
        'semantic',
        {
          id: 'semantic',
          name: 'Semantic',
          defaultModeId: 'light',
          modes: [{ modeId: 'light', name: 'Light' }],
        },
      ],
      [
        'primitive',
        {
          id: 'primitive',
          name: 'Primitive',
          defaultModeId: 'value',
          modes: [{ modeId: 'value', name: 'Value' }],
        },
      ],
    ])
    const primitive = {
      id: 'blue',
      name: 'colors/blue/500',
      variableCollectionId: 'primitive',
      resolvedType: 'COLOR',
      valuesByMode: { value: { r: 0, g: 0.5, b: 1 } },
      resolveForConsumer: vi.fn(() => ({
        value: { r: 0, g: 0.5, b: 1 },
        resolvedType: 'COLOR',
      })),
    }
    const semantic = {
      id: 'primary',
      name: 'color/primary',
      remote: true,
      variableCollectionId: 'semantic',
      resolvedType: 'COLOR',
      valuesByMode: {
        light: { type: 'VARIABLE_ALIAS', id: 'blue' },
      },
      resolveForConsumer: vi.fn(() => ({
        value: { r: 0, g: 0.5, b: 1 },
        resolvedType: 'COLOR',
      })),
    }
    const variables = new Map<string, unknown>([
      ['primary', semantic],
      ['blue', primitive],
    ])
    Object.assign(figma.variables, {
      getVariableByIdAsync: vi.fn(async (id: string) => variables.get(id) ?? null),
      getVariableCollectionByIdAsync: vi.fn(
        async (id: string) => collections.get(id) ?? null,
      ),
    })
    const consumer = node('consumer', 'RECTANGLE', 'Card', [], {
      resolvedVariableModes: { semantic: 'light', primitive: 'value' },
    })

    const result = await new VisualVariableResolver().resolve(
      consumer as unknown as SceneNode,
      [{ type: 'VARIABLE_ALIAS', id: 'primary' }],
    )
    expect(result[0]).toMatchObject({
      variableName: 'color/primary',
      collectionName: 'Semantic',
      modeName: 'Light',
      resolvedPreview: '#0080FF',
      status: 'resolved',
    })
    expect(result[0]?.aliasChain.map((step) => step.variableName)).toEqual([
      'color/primary',
      'colors/blue/500',
    ])
  })

  it('reports missing variables and alias cycles without throwing', async () => {
    const collection = {
      id: 'tokens',
      name: 'Tokens',
      defaultModeId: 'mode',
      modes: [{ modeId: 'mode', name: 'Mode' }],
    }
    const cycleA = {
      id: 'a',
      name: 'a',
      variableCollectionId: 'tokens',
      resolvedType: 'FLOAT',
      valuesByMode: { mode: { type: 'VARIABLE_ALIAS', id: 'b' } },
      resolveForConsumer: vi.fn(() => {
        throw new Error('cycle')
      }),
    }
    const cycleB = {
      id: 'b',
      name: 'b',
      variableCollectionId: 'tokens',
      resolvedType: 'FLOAT',
      valuesByMode: { mode: { type: 'VARIABLE_ALIAS', id: 'a' } },
      resolveForConsumer: vi.fn(),
    }
    const variables = new Map<string, unknown>([
      ['a', cycleA],
      ['b', cycleB],
    ])
    Object.assign(figma.variables, {
      getVariableByIdAsync: vi.fn(async (id: string) => variables.get(id) ?? null),
      getVariableCollectionByIdAsync: vi.fn(async () => collection),
    })
    const consumer = node('consumer', 'RECTANGLE', 'Card')
    const resolver = new VisualVariableResolver()

    const [cycle] = await resolver.resolve(consumer as unknown as SceneNode, [
      { type: 'VARIABLE_ALIAS', id: 'a' },
    ])
    const [missing] = await resolver.resolve(consumer as unknown as SceneNode, [
      { type: 'VARIABLE_ALIAS', id: 'missing' },
    ])
    expect(cycle?.status).toBe('cycle')
    expect(missing?.status).toBe('missing')
  })
})
