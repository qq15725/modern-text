import type { MeasureResult } from '../Text'
import type { TextOptions } from '../types'
import { Text } from '../Text'

export async function measureText(options: TextOptions): Promise<MeasureResult> {
  const text = new Text(options)
  await text.load()
  return text.measure()
}
