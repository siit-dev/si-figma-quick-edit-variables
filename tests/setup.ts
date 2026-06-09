import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

Object.assign(globalThis, {
  figma: {
    mixed: Symbol('mixed'),
    variables: {
      setBoundVariableForPaint: vi.fn((paint, _field, variable) => ({
        ...paint,
        boundVariables: { color: { type: 'VARIABLE_ALIAS', id: variable.id } },
      })),
      setBoundVariableForEffect: vi.fn((effect, field, variable) => ({
        ...effect,
        boundVariables: {
          ...effect.boundVariables,
          [field]: { type: 'VARIABLE_ALIAS', id: variable.id },
        },
      })),
      setBoundVariableForLayoutGrid: vi.fn((grid, field, variable) => ({
        ...grid,
        boundVariables: {
          ...grid.boundVariables,
          [field]: { type: 'VARIABLE_ALIAS', id: variable.id },
        },
      })),
      createVariableAlias: vi.fn((variable) => ({
        type: 'VARIABLE_ALIAS',
        id: variable.id,
      })),
    },
    loadFontAsync: vi.fn(),
  },
})

