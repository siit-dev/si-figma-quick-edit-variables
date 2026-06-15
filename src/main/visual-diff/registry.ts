import { appearanceAdapter } from './appearance'
import { geometryAdapter } from './geometry'
import { spacingAdapter } from './spacing'
import { typographyAdapter } from './typography'
import type { VisualPropertyAdapter } from './types'

export const visualPropertyAdapters: VisualPropertyAdapter[] = [
  appearanceAdapter,
  typographyAdapter,
  spacingAdapter,
  geometryAdapter,
]
