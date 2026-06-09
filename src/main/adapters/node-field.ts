import type { BindingAdapter, DiscoveredBinding } from './types'
import { isAlias } from './types'

const LABELS: Record<string, string> = {
  height: 'Height',
  width: 'Width',
  characters: 'Text content',
  itemSpacing: 'Item spacing',
  paddingLeft: 'Padding left',
  paddingRight: 'Padding right',
  paddingTop: 'Padding top',
  paddingBottom: 'Padding bottom',
  visible: 'Visibility',
  topLeftRadius: 'Top-left radius',
  topRightRadius: 'Top-right radius',
  bottomLeftRadius: 'Bottom-left radius',
  bottomRightRadius: 'Bottom-right radius',
  minWidth: 'Minimum width',
  maxWidth: 'Maximum width',
  minHeight: 'Minimum height',
  maxHeight: 'Maximum height',
  counterAxisSpacing: 'Counter-axis spacing',
  strokeWeight: 'Stroke weight',
  strokeTopWeight: 'Stroke top weight',
  strokeRightWeight: 'Stroke right weight',
  strokeBottomWeight: 'Stroke bottom weight',
  strokeLeftWeight: 'Stroke left weight',
  opacity: 'Opacity',
  gridRowGap: 'Grid row gap',
  gridColumnGap: 'Grid column gap',
}

const TEXT_FIELDS = new Set([
  'fontFamily',
  'fontSize',
  'fontStyle',
  'fontWeight',
  'letterSpacing',
  'lineHeight',
  'paragraphSpacing',
  'paragraphIndent',
])

export const nodeFieldAdapter: BindingAdapter = {
  kind: 'node-field',
  scan(node): DiscoveredBinding[] {
    const bindings = node.boundVariables
    if (!bindings) return []

    return Object.entries(bindings).flatMap(([field, alias]) => {
      if (TEXT_FIELDS.has(field) || Array.isArray(alias) || !isAlias(alias)) return []
      if (['fills', 'strokes', 'effects', 'layoutGrids', 'componentProperties', 'textRangeFills'].includes(field)) {
        return []
      }
      return [
        {
          locator: { kind: 'node-field', field },
          alias,
          propertyLabel: LABELS[field] ?? field,
        },
      ]
    })
  },
}
