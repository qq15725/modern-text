import type { MeasureResult, TextOptions } from './Text'
import { Text } from './Text'

export function measureText(options: TextOptions): MeasureResult {
  return new Text(options).measure()
}
