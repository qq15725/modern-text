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
export type TextDecoration = 'none' | 'underline' | 'line-through'
export type ListStyleType = 'none' | 'disc' /* 'decimal' | 'circle' | 'square' | 'georgian'  | 'trad-chinese-informal' | 'kannada' */
export type ListStyleImage = 'none' | string
export type ListStyleSize = 'cover' | Sizeable
export type ListStylePosition = 'inside' | 'outside'
export type HighlightImage = 'none' | string
export type HighlightSize = 'cover' | Sizeable
export type HighlightStrokeWidth = Sizeable
export type HighlightOverflow = 'none' | 'visible' | 'hidden'

export interface TextLayoutStyle {
  writingMode: WritingMode
  verticalAlign: VerticalAlign
  lineHeight: number
  letterSpacing: number
  // font
  fontSize: number
  fontWeight: FontWeight
  fontFamily: string
  fontStyle: FontStyle
  fontKerning?: FontKerning
  // text
  textWrap: TextWrap
  textAlign: TextAlign
  textTransform: TextTransform
  textOrientation: TextOrientation
}

export interface TextDrawStyle {
  color: string | CanvasGradient | CanvasPattern
  backgroundColor: string | CanvasGradient | CanvasPattern
  // text
  textDecoration: TextDecoration
  // textStroke
  textStrokeWidth: number
  textStrokeColor: string | CanvasGradient | CanvasPattern
  // shadow
  shadowColor: string
  shadowOffsetX: number
  shadowOffsetY: number
  shadowBlur: number
}

export interface TextListStyle {
  listStyleType: ListStyleType
  listStyleImage: ListStyleImage
  listStyleSize: ListStyleSize
  listStylePosition: ListStylePosition
}

export interface TextHighlightStyle {
  highlightReferImage: HighlightImage
  highlightImage: HighlightImage
  highlightSize: HighlightSize
  highlightStrokeWidth: HighlightStrokeWidth
  highlightOverflow: HighlightOverflow
}

export interface TextStyle extends
  TextLayoutStyle,
  TextDrawStyle,
  TextListStyle,
  TextHighlightStyle {
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
