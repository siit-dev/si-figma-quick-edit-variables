import type { VisualProperty, VisualPropertyAdapter } from './types'
import { readBoundAliases } from './types'

export const geometryAdapter: VisualPropertyAdapter = {
  id: 'geometry',
  extract(node) {
    const properties: VisualProperty[] = []
    if (!derivedWidth(node)) addNumber(properties, node, 'width', 'Width')
    if (!derivedHeight(node)) addNumber(properties, node, 'height', 'Height')

    for (const [field, label] of [
      ['minWidth', 'Minimum width'],
      ['maxWidth', 'Maximum width'],
      ['minHeight', 'Minimum height'],
      ['maxHeight', 'Maximum height'],
    ] as const) {
      addNumber(properties, node, field, label)
    }

    if (comparePosition(node)) {
      addNumber(properties, node, 'x', 'Horizontal position')
      addNumber(properties, node, 'y', 'Vertical position')
    }
    addNumber(properties, node, 'rotation', 'Rotation', 'deg')

    for (const [field, label] of [
      ['layoutMode', 'Layout direction'],
      ['layoutWrap', 'Layout wrapping'],
      ['layoutPositioning', 'Layout positioning'],
      ['layoutAlign', 'Layout alignment'],
      ['layoutGrow', 'Layout grow'],
      ['primaryAxisSizingMode', 'Primary-axis sizing'],
      ['counterAxisSizingMode', 'Counter-axis sizing'],
      ['primaryAxisAlignItems', 'Primary-axis alignment'],
      ['counterAxisAlignItems', 'Counter-axis alignment'],
    ] as const) {
      addScalar(properties, node, field, label)
    }
    return properties
  },
}

function addNumber(
  properties: VisualProperty[],
  node: SceneNode,
  field: string,
  label: string,
  unit = 'px',
) {
  const value = read(node, field)
  if (typeof value !== 'number') return
  properties.push({
    field,
    label,
    category: 'geometry',
    value,
    unit,
    aliases: readBoundAliases(node, field),
  })
}

function addScalar(
  properties: VisualProperty[],
  node: SceneNode,
  field: string,
  label: string,
) {
  const value = read(node, field)
  if (value === undefined || value === figma.mixed) return
  properties.push({ field, label, category: 'geometry', value })
}

function read(node: SceneNode, field: string): unknown {
  try {
    return (node as unknown as Record<string, unknown>)[field]
  } catch {
    return undefined
  }
}

function derivedWidth(node: SceneNode): boolean {
  if (node.type === 'TEXT') {
    return node.textAutoResize === 'WIDTH_AND_HEIGHT'
  }
  if (!('layoutMode' in node) || node.layoutMode === 'NONE') return false
  if (node.layoutMode === 'HORIZONTAL') return node.primaryAxisSizingMode === 'AUTO'
  if (node.layoutMode === 'VERTICAL') return node.counterAxisSizingMode === 'AUTO'
  return false
}

function derivedHeight(node: SceneNode): boolean {
  if (node.type === 'TEXT') {
    return node.textAutoResize === 'WIDTH_AND_HEIGHT' || node.textAutoResize === 'HEIGHT'
  }
  if (!('layoutMode' in node) || node.layoutMode === 'NONE') return false
  if (node.layoutMode === 'VERTICAL') return node.primaryAxisSizingMode === 'AUTO'
  if (node.layoutMode === 'HORIZONTAL') return node.counterAxisSizingMode === 'AUTO'
  return false
}

function comparePosition(node: SceneNode): boolean {
  const parent = node.parent
  if (!parent || !('layoutMode' in parent) || parent.layoutMode === 'NONE') return true
  return 'layoutPositioning' in node && node.layoutPositioning === 'ABSOLUTE'
}
