import { describe, expect, it } from 'vitest'
import { colorToHex, parseHexColor, parseValue } from '../src/shared/values'

describe('value parsing', () => {
  it('parses and formats RGB and RGBA hex colors', () => {
    expect(parseHexColor('#369')).toEqual({
      r: 0x33 / 255,
      g: 0x66 / 255,
      b: 0x99 / 255,
    })
    expect(colorToHex(parseHexColor('#33669980'))).toBe('#33669980')
  })

  it('validates floats and booleans', () => {
    expect(parseValue('FLOAT', '12.5')).toBe(12.5)
    expect(parseValue('BOOLEAN', 'TRUE')).toBe(true)
    expect(() => parseValue('FLOAT', 'NaN')).toThrow('finite number')
    expect(() => parseValue('BOOLEAN', 'yes')).toThrow('true or false')
  })
})
