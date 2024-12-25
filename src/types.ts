import type { Fonts } from 'modern-font'
import type { ITextContent, ITextStyle } from 'modern-idoc'
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

export interface TextOptions {
  debug?: boolean
  content?: ITextContent
  style?: Partial<ITextStyle>
  measureDom?: HTMLElement
  effects?: Partial<ITextStyle>[]
  fonts?: Fonts
}
