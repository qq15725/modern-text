import type { Fonts } from 'modern-font'
import type { BoundingBox, Path2D } from 'modern-path2d'
import type { Text } from './Text'

export type Sizeable = `${number}%` | `${number}rem` | number
export type WritingMode = 'horizontal-tb' | 'vertical-lr' | 'vertical-rl'
export type TextOrientation = 'mixed' | 'upright' | 'sideways-right' | 'sideways' /* | 'use-glyph-orientation' */
export type FontWeight = 'normal' | 'bold' | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900
export type FontStyle = 'normal' | 'italic' | 'oblique' | `oblique ${string}`
export type FontKerning = 'none' | 'auto' | 'normal'
export type TextWrap = 'wrap' | 'nowrap'
export type TextAlign = 'center' | 'end' | 'left' | 'right' | 'start'
export type VerticalAlign = 'baseline' | 'top' | 'middle' | 'bottom' | 'sub' | 'super' | 'text-top' | 'text-bottom'
export type TextTransform = 'none' | 'uppercase' | 'lowercase'
export type TextDecorationLine = 'none' | 'underline' | 'line-through' | 'overline'
export type ListStyleType = 'none' | 'disc' /* 'decimal' | 'circle' | 'square' | 'georgian'  | 'trad-chinese-informal' | 'kannada' */
export type ListStyleImage = 'none' | string
export type ListStyleSize = 'cover' | Sizeable
export type ListStylePosition = 'inside' | 'outside'
export type HighlightLine = TextDecorationLine | 'outline'
export type HighlightImage = 'none' | string
export type HighlightSize = 'cover' | Sizeable
export type HighlightThickness = Sizeable
export type HighlightOverflow = 'none' | 'visible' | 'hidden'

export interface TextLineStyle {
  writingMode: WritingMode
  textWrap: TextWrap
  textAlign: TextAlign
  textIndent: number
  lineHeight: number
  listStyleType: ListStyleType
  listStyleImage: ListStyleImage
  listStyleImageColors: Record<string, string>
  listStyleSize: ListStyleSize
  listStylePosition: ListStylePosition
}

export interface TextInlineStyle {
  verticalAlign: VerticalAlign
  letterSpacing: number
  fontSize: number
  fontWeight: FontWeight
  fontFamily: string
  fontStyle: FontStyle
  fontKerning?: FontKerning
  textTransform: TextTransform
  textOrientation: TextOrientation
  textDecoration: TextDecorationLine
  // extended part
  highlightImage: HighlightImage
  highlightImageColors: Record<string, string>
  highlightLine: HighlightLine
  highlightSize: HighlightSize
  highlightThickness: HighlightThickness
  highlightOverflow: HighlightOverflow
}

export interface TextDrawStyle {
  color: string | CanvasGradient | CanvasPattern
  backgroundColor: string | CanvasGradient | CanvasPattern
  textStrokeWidth: number
  textStrokeColor: string | CanvasGradient | CanvasPattern
  shadowColor: string
  shadowOffsetX: number
  shadowOffsetY: number
  shadowBlur: number
  translateX: number
  translateY: number
  skewX: number
  skewY: number
}

export interface TextStyle extends
  TextLineStyle,
  TextInlineStyle,
  TextDrawStyle {
  //
}

export interface FragmentContent extends Partial<TextStyle> {
  content: string
}

export interface ParagraphContent extends Partial<TextStyle> {
  fragments: FragmentContent[]
}

export type TextContent =
  | string
  | FragmentContent
  | ParagraphContent
  | (string | FragmentContent | ParagraphContent | (string | FragmentContent)[])[]

type PromiseLike<T> = T | Promise<T>

export interface TextPlugin {
  name: string
  paths?: Path2D[]
  getBoundingBox?: (text: Text) => BoundingBox | undefined
  updateOrder?: number
  update?: (text: Text) => PromiseLike<void>
  renderOrder?: number
  render?: (ctx: CanvasRenderingContext2D, text: Text) => PromiseLike<void>
}

export interface TextOptions {
  debug?: boolean
  content?: TextContent
  style?: Partial<TextStyle>
  measureDom?: HTMLElement
  effects?: Partial<TextStyle>[]
  fonts?: Fonts
}
