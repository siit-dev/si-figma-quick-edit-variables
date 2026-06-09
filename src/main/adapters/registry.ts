import type { BindingAdapter } from './types'
import { componentPropertyAdapter } from './component-property'
import { effectAdapter } from './effect'
import { layoutGridAdapter } from './layout-grid'
import { nodeFieldAdapter } from './node-field'
import { paintAdapter } from './paint'
import { textFieldAdapter, textRangeFillAdapter } from './text'

export const bindingAdapters: BindingAdapter[] = [
  nodeFieldAdapter,
  paintAdapter,
  effectAdapter,
  layoutGridAdapter,
  textFieldAdapter,
  textRangeFillAdapter,
  componentPropertyAdapter,
]
