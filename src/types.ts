import type { Fonts } from 'modern-font'
import type { TextObject as _TextOptions, FullStyle } from 'modern-idoc'
import type { BoundingBox, Path2DSet } from 'modern-path2d'
import type { Canvas2DRenderer } from './Canvas2DRenderer'
import type { Paragraph } from './content'
import type { Text } from './Text'

/**
 * A measurer's output: the paragraphs with their four-level boxes filled in place,
 * plus the overall bounding box. (Formerly `MeasureDomResult`; layout is now
 * DOM-free via {@link import('./Measurer').Measurer}.)
 */
export interface MeasurerResult {
  paragraphs: Paragraph[]
  boundingBox: BoundingBox
}

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
 * The built-in backend is the pure-JS, DOM-free {@link import('./Measurer').Measurer},
 * which resolves glyph advances/kerning from `modern-font` — it runs in Node/SSR/Worker
 * and measures the exact font that is rendered. `fonts` is passed positionally by
 * `Text.measure()`.
 */
export interface TextMeasurer {
  measure: (paragraphs: Paragraph[], rootStyle: FullStyle, dom?: HTMLElement, fonts?: Fonts) => MeasurerResult
  dispose?: () => void
}

export interface Options extends _TextOptions {
  debug?: boolean
  measureDom?: HTMLElement
  fonts?: Fonts
  plugins?: Plugin[]
}
