import type { SerializableValue } from '../../shared/types'
import { colorToHex, formatValue, isAlias } from '../../shared/values'

export function ValuePreview({ value }: { value: SerializableValue | null }) {
  const isColor =
    value !== null &&
    typeof value === 'object' &&
    !isAlias(value) &&
    'r' in value

  return (
    <span className="value-preview" title={formatValue(value)}>
      {isColor ? (
        <span
          className="swatch"
          style={{ background: colorToHex(value) }}
          aria-hidden="true"
        />
      ) : null}
      <span className="truncate">{formatValue(value)}</span>
    </span>
  )
}

