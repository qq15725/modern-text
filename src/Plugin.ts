import type { BoundingBox, Path2D } from 'modern-path2d'
import type { Text } from './Text'

type PromiseLike<T> = T | Promise<T>

export interface Plugin {
  name: string
  paths?: Path2D[]
  getBoundingBox?: (text: Text) => BoundingBox | undefined
  updateOrder?: number
  update?: (text: Text) => PromiseLike<void>
  renderOrder?: number
  render?: (ctx: CanvasRenderingContext2D, text: Text) => PromiseLike<void>
}

export function definePlugin(options: Plugin): Plugin {
  return options
}
