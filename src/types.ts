import type { Fonts } from 'modern-font'
import type { TextObject as _TextOptions } from 'modern-idoc'
import type { BoundingBox, Path2DSet } from 'modern-path2d'
import type { Text } from './Text'

export interface TextPlugin {
  name: string
  pathSet?: Path2DSet
  getBoundingBox?: (text: Text) => BoundingBox | undefined
  update?: (text: Text) => void
  updateOrder?: number
  render?: (ctx: CanvasRenderingContext2D, text: Text) => void
  renderOrder?: number
  load?: (text: Text) => Promise<void>
}

export interface TextOptions extends _TextOptions {
  debug?: boolean
  measureDom?: HTMLElement
  fonts?: Fonts
  plugins?: TextPlugin[]
}
