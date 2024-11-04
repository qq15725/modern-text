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
export type ListStylePosition = 'inside' | 'outside'

export interface TextLayoutStyle {
  writingMode: WritingMode
  verticalAlign: VerticalAlign
  lineHeight: number
  letterSpacing: number
  // text
  textTransform: TextTransform
  textOrientation: TextOrientation
  // font
  fontSize: number
  fontWeight: FontWeight
  fontFamily: string
  fontStyle: FontStyle
  fontKerning?: FontKerning
  textWrap: TextWrap
  textAlign: TextAlign
}

export interface TextStyleStyle {
  // listStyle
  listStyleType: ListStyleType
  listStyleImage: ListStyleImage
  listStylePosition: ListStylePosition
}

export interface TextDrawStyle {
  color: string | CanvasGradient | CanvasPattern
  backgroundColor: string | CanvasGradient | CanvasPattern
  // textStroke
  textStrokeWidth: number
  textStrokeColor: string | CanvasGradient | CanvasPattern
  textDecoration: TextDecoration
  // shadow
  shadowColor: string
  shadowOffsetX: number
  shadowOffsetY: number
  shadowBlur: number
}

export interface TextStyle extends TextLayoutStyle, TextStyleStyle, TextDrawStyle {
  //
}

export interface FragmentContent extends Partial<TextStyle> {
  content: string
  highlight?: FragmentHighlight
}

export interface ParagraphContent extends Partial<TextStyle> {
  fragments: FragmentContent[]
}

export type TextContent =
  | string
  | FragmentContent
  | ParagraphContent
  | (string | FragmentContent | ParagraphContent | (string | FragmentContent)[])[]

export interface FragmentHighlight {
  image: string // svg url
  strokeWidth?: number
  charsPerRepeat?: number
  overflowHidden?: boolean
}
