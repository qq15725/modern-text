import type { MeasureResult } from '../Text'
import type { Options } from '../types'
import { Text } from '../Text'

export function measureText(options: Options, load: true): Promise<MeasureResult>
export function measureText(options: Options): MeasureResult
export function measureText(options: Options, load?: boolean): MeasureResult | Promise<MeasureResult> {
  const text = new Text(options)
  if (load) {
    return text.load().then(() => {
      return text.measure()
    })
  }
  return text.measure()
}
