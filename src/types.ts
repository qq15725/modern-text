import type { Fonts } from 'modern-font'
import type { IText } from 'modern-idoc'
import type { BoundingBox, Path2D } from 'modern-path2d'
import type { Text } from './Text'

export interface TextPlugin {
  name: string
  paths?: Path2D[]
  getBoundingBox?: (text: Text) => BoundingBox | undefined
  update?: (text: Text) => void
  updateOrder?: number
  render?: (ctx: CanvasRenderingContext2D, text: Text) => void
  renderOrder?: number
  load?: (text: Text) => Promise<void>
}

export interface TextOptions extends Partial<Omit<IText, 'type'>> {
  debug?: boolean
  measureDom?: HTMLElement
  fonts?: Fonts
}
