import { describe, expect, it } from 'vitest'
import { generateDiffCss, sanitizeIdentifier } from '../src/shared/css-generator'
import { normalizeDiffCodePreferences } from '../src/shared/diff-code-preferences'
import type { InstanceDiff, VisualStyleProperty } from '../src/shared/types'

const property = (
  field: string,
  category: VisualStyleProperty['category'],
  detail: string,
  preview: string,
  tokens?: VisualStyleProperty['value']['tokens'],
): VisualStyleProperty => ({
  field,
  label: field,
  category,
  value: { detail, preview, kind: detail.startsWith('[') ? 'complex' : 'scalar', tokens },
})

function fixture(name = 'Status badge', id = '12:3'): InstanceDiff {
  return {
    instanceId: 'instance',
    instanceName: 'Card',
    instancePath: ['Card'],
    mainComponentId: 'main',
    mainComponentName: 'Card',
    mainComponentRemote: false,
    differenceCount: 2,
    layers: [{
      nodeId: id,
      nodeName: name,
      nodeType: 'RECTANGLE',
      nodePath: ['Card', name],
      differences: [
        {
          id: `${id}:fill`,
          affectedNodeId: id,
          affectedNodeName: name,
          affectedNodeType: 'RECTANGLE',
          nodePath: ['Card', name],
          field: 'fills',
          label: 'Fill',
          category: 'appearance',
          original: { preview: '#000000', detail: '[]', kind: 'complex' },
          current: { preview: '#1677FF', detail: '[]', kind: 'complex' },
        },
      ],
      currentProperties: [
        property(
          'fills',
          'appearance',
          JSON.stringify([{ type: 'SOLID', color: { r: 0.086, g: 0.467, b: 1 } }]),
          '#1677FF',
          [{
            variableId: 'blue',
            variableName: 'colors/primary',
            collectionId: 'semantic',
            collectionName: 'Semantic',
            modeId: 'light',
            modeName: 'Light',
            resolvedType: 'COLOR',
            resolvedPreview: '#1677FF',
            status: 'resolved',
            aliasChain: [],
          }],
        ),
        property('paddingLeft', 'spacing', '16', '16 px'),
        property('fontSize', 'typography', '16', '16 px', [{
          variableId: 'size',
          variableName: 'font/size',
          collectionId: 'semantic',
          collectionName: 'Semantic',
          modeId: 'desktop',
          modeName: 'Desktop',
          resolvedType: 'FLOAT',
          resolvedPreview: '16',
          status: 'resolved',
          aliasChain: [],
        }]),
        property('width', 'geometry', '120', '120 px'),
      ],
    }],
  }
}

describe('CSS generator', () => {
  it('emits readable token fallbacks, paths, and supported declarations', () => {
    const css = generateDiffCss({
      instances: [fixture()],
      activeCategories: new Set(),
      scope: 'selected-categories',
    })
    expect(css).toContain('/* Card / Status badge */')
    expect(css).toContain('.status-badge {')
    expect(css).toContain('background-color: var(--semantic-colors-primary, #1677FF);')
    expect(css).toContain('padding-left: 16px;')
    expect(css).toContain('font-size: var(--semantic-font-size, 16px);')
    expect(css).toContain('width: 120px;')
  })

  it('honors matched and selected-category scopes', () => {
    const matched = generateDiffCss({
      instances: [fixture()],
      activeCategories: new Set(),
      scope: 'matched-properties',
    })
    expect(matched).toContain('background-color')
    expect(matched).not.toContain('padding-left')

    const appearance = generateDiffCss({
      instances: [fixture()],
      activeCategories: new Set(['appearance']),
      scope: 'selected-categories',
    })
    expect(appearance).toContain('background-color')
    expect(appearance).not.toContain('padding-left')
  })

  it('uses stable node suffixes for selector collisions', () => {
    const css = generateDiffCss({
      instances: [fixture('Badge', '12:3'), fixture('Badge', '18:4')],
      activeCategories: new Set(),
      scope: 'full-layers',
    })
    expect(css).toContain('.badge--12-3')
    expect(css).toContain('.badge--18-4')
  })

  it('sanitizes selectors and normalizes persisted preferences', () => {
    expect(sanitizeIdentifier('Crème / CTA 2')).toBe('creme-cta-2')
    expect(normalizeDiffCodePreferences({ scope: 'bad', height: 999, collapsed: 1 }))
      .toEqual({ scope: 'selected-categories', height: 420, collapsed: false })
  })

  it('returns an explicit empty result', () => {
    expect(generateDiffCss({
      instances: [],
      activeCategories: new Set(),
      scope: 'full-layers',
    })).toBe('/* No matching layers. */')
  })
})
