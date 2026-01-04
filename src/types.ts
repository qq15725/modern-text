import type { Fonts } from 'modern-font'
import type { TextObject as _TextOptions } from 'modern-idoc'
import type { BoundingBox, Path2DSet } from 'modern-path2d'
import type { Canvas2DRenderer } from './Canvas2DRenderer'
import type { Text } from './Text'

export interface Plugin {
  name: string
  pathSet?: Path2DSet
  getBoundingBox?: (text: Text) => BoundingBox | undefined
  update?: (text: Text) => void
  updateOrder?: number
  render?: (renderer: Canvas2DRenderer) => void
  renderOrder?: number
  load?: (text: Text) => Promise<void>
  context?: Record<string, any>
}

export interface Options extends _TextOptions {
  debug?: boolean
  measureDom?: HTMLElement
  fonts?: Fonts
  plugins?: Plugin[]
}
