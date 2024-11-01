import type { BoundingBox, Path2D } from './lib'
import type { Text } from './Text'

export interface Plugin {
  name: string
  paths?: Path2D[]
  getBoundingBox?: (text: Text) => BoundingBox
  updateOrder?: number
  update?: (text: Text) => void
  renderOrder?: number
  render?: (ctx: CanvasRenderingContext2D, text: Text) => void
}

export function plugin(options: Plugin): Plugin {
  return options
}
