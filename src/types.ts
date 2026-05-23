import type { Fonts } from 'modern-font'
import type { TextObject as _TextOptions, FullStyle } from 'modern-idoc'
import type { BoundingBox, Path2DSet } from 'modern-path2d'
import type { Canvas2DRenderer } from './Canvas2DRenderer'
import type { Paragraph } from './content'
import type { MeasureDomResult } from './DomMeasurer'
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

/**
 * Pluggable layout backend. Implementations fill the four-level boxes
 * (`character.inlineBox`/`lineBox`, `fragment.inlineBox`, `paragraph.lineBox`)
 * in place and return the overall bounding box.
 *
 * - `DomMeasurer` — DOM-based, uses the browser as ground truth (default).
 * - `FontMeasurer` — pure-JS, DOM-free; needs `fonts` to resolve glyph advances.
 *
 * `fonts` is passed positionally by `Text.measure()`; DOM-based measurers ignore
 * it (a method may safely declare fewer parameters than the interface).
 */
export interface TextMeasurer {
  measure: (paragraphs: Paragraph[], rootStyle: FullStyle, dom?: HTMLElement, fonts?: Fonts) => MeasureDomResult
  createDom?: (paragraphs: Paragraph[], rootStyle: FullStyle) => HTMLElement
  dispose?: () => void
}

export interface Options extends _TextOptions {
  debug?: boolean
  measureDom?: HTMLElement
  fonts?: Fonts
  plugins?: Plugin[]
  /** Override the layout backend. Defaults to the DOM-based `DomMeasurer`. */
  measurer?: TextMeasurer
}
