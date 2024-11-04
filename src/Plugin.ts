import type { BoundingBox, Path2D } from 'modern-path2d'
import type { Text } from './Text'

export interface Plugin {
  name: string
  paths?: Path2D[]
  getBoundingBox?: (text: Text) => BoundingBox | undefined
  updateOrder?: number
  update?: (text: Text) => void
  renderOrder?: number
  render?: (ctx: CanvasRenderingContext2D, text: Text) => void
}

export function definePlugin(options: Plugin): Plugin {
  return options
}
