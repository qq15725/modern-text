import type { Fonts } from 'modern-font'
import type { StyleDeclaration, TextContent } from 'modern-idoc'
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
  style?: Partial<StyleDeclaration>
  content?: TextContent
  effects?: Partial<StyleDeclaration>[]
  debug?: boolean
  measureDom?: HTMLElement
  fonts?: Fonts
}
