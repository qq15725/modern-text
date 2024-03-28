export type WritingMode = 'horizontal-tb' | 'vertical-lr' | 'vertical-rl'
export type FontWeight = 'normal' | 'bold' | 'lighter' | 'bolder' | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900
export type FontStyle = 'normal' | 'italic' | 'oblique' | `oblique ${ string }`
export type FontKerning = 'auto' | 'none' | 'normal'
export type TextWrap = 'wrap' | 'nowrap'
export type TextAlign = 'center' | 'end' | 'left' | 'right' | 'start'
export type VerticalAlign = 'baseline' | 'top' | 'middle' | 'bottom' | 'sub' | 'super' | 'text-top' | 'text-bottom'
export type TextTransform = 'uppercase' | 'lowercase' | 'none'
export type TextDecoration = 'underline' | 'line-through'

export interface TextLayoutStyle {
  writingMode: WritingMode
  fontSize: number
  fontWeight: FontWeight
  fontFamily: string
  fontStyle: FontStyle
  fontKerning: FontKerning
  textWrap: TextWrap
  textAlign: TextAlign
  verticalAlign: VerticalAlign
  textTransform: TextTransform
  lineHeight: number
  letterSpacing: number
}

export interface TextDrawStyle {
  color: string | CanvasGradient | CanvasPattern | null
  backgroundColor: string | CanvasGradient | CanvasPattern | null
  textStrokeWidth: number
  textStrokeColor: string | CanvasGradient | CanvasPattern | null
  textDecoration: TextDecoration | null
  shadowColor: string | null
  shadowOffsetX: number
  shadowOffsetY: number
  shadowBlur: number
}

export type TextEffect = Partial<TextDrawStyle & { offsetX: number; offsetY: number }>

export interface TextStyle extends TextLayoutStyle, TextDrawStyle {
  //
}

export interface FragmentContent extends Partial<TextStyle> {
  content: string
}

export interface ParagraphContent extends Partial<TextStyle> {
  fragments: Array<FragmentContent>
}

export type TextContent =
  | string | FragmentContent | ParagraphContent
  | Array<string | Array<string | FragmentContent> | FragmentContent | ParagraphContent>
