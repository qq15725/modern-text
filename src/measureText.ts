import type { MeasureResult } from './Text'
import type { TextOptions } from './types'
import { Text } from './Text'

export function measureText(options: TextOptions): Promise<MeasureResult> {
  return new Text(options).measure()
}
