import type { MeasureResult } from '../Text'
import type { TextOptions } from '../types'
import { Text } from '../Text'

export function measureText(options: TextOptions & { load: true }): Promise<MeasureResult>
export function measureText(options: TextOptions & { load?: false }): MeasureResult
export function measureText(options: TextOptions & { load?: boolean }): MeasureResult | Promise<MeasureResult> {
  const text = new Text(options)
  if (options.load) {
    return text.load().then(() => {
      return text.measure()
    })
  }
  return text.measure()
}
