import type { PropertyLocator, ResolvedType, VariableSummary } from './types'

const SCOPES: Record<string, string[]> = {
  width: ['WIDTH_HEIGHT'],
  height: ['WIDTH_HEIGHT'],
  minWidth: ['WIDTH_HEIGHT'],
  maxWidth: ['WIDTH_HEIGHT'],
  minHeight: ['WIDTH_HEIGHT'],
  maxHeight: ['WIDTH_HEIGHT'],
  itemSpacing: ['GAP'],
  counterAxisSpacing: ['GAP'],
  gridRowGap: ['GAP'],
  gridColumnGap: ['GAP'],
  paddingLeft: ['GAP'],
  paddingRight: ['GAP'],
  paddingTop: ['GAP'],
  paddingBottom: ['GAP'],
  topLeftRadius: ['CORNER_RADIUS'],
  topRightRadius: ['CORNER_RADIUS'],
  bottomLeftRadius: ['CORNER_RADIUS'],
  bottomRightRadius: ['CORNER_RADIUS'],
  opacity: ['OPACITY'],
  strokeWeight: ['STROKE_FLOAT'],
  strokeTopWeight: ['STROKE_FLOAT'],
  strokeRightWeight: ['STROKE_FLOAT'],
  strokeBottomWeight: ['STROKE_FLOAT'],
  strokeLeftWeight: ['STROKE_FLOAT'],
  fontFamily: ['FONT_FAMILY'],
  fontStyle: ['FONT_STYLE'],
  fontWeight: ['FONT_WEIGHT'],
  fontSize: ['FONT_SIZE'],
  letterSpacing: ['LETTER_SPACING'],
  lineHeight: ['LINE_HEIGHT'],
  paragraphSpacing: ['PARAGRAPH_SPACING'],
  paragraphIndent: ['PARAGRAPH_INDENT'],
}

export function requiredScopes(locator: PropertyLocator): string[] {
  if (locator.kind === 'paint' || locator.kind === 'text-range-fill') {
    if (locator.field === 'strokes') return ['STROKE_COLOR']
    return ['ALL_FILLS', 'FRAME_FILL', 'SHAPE_FILL', 'TEXT_FILL']
  }
  if (locator.kind === 'effect') {
    return locator.subfield === 'color' ? ['EFFECT_COLOR'] : ['EFFECT_FLOAT']
  }
  return SCOPES[locator.field] ?? []
}

export function isPickerEligible(
  variable: VariableSummary,
  resolvedType: ResolvedType,
  locator: PropertyLocator,
): boolean {
  if (variable.remote || variable.excluded || variable.resolvedType !== resolvedType) return false
  if (variable.scopes.length === 0 || variable.scopes.includes('ALL_SCOPES')) return true
  const scopes = requiredScopes(locator)
  return scopes.length === 0 || scopes.some((scope) => variable.scopes.includes(scope))
}

