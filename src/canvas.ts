import type { TextStyle } from './types'

const SUPPORTS_OFFSCREEN_CANVAS = 'OffscreenCanvas' in globalThis

let currentCanvas: OffscreenCanvas | HTMLCanvasElement | undefined

export function getCurrentCanvas() {
  return currentCanvas ??= (
    SUPPORTS_OFFSCREEN_CANVAS
      ? new OffscreenCanvas(1, 1)
      : document.createElement('canvas')
  )
}

export function setContextStyle(ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D, style: Partial<TextStyle>) {
  ctx.shadowColor = style.shadowColor || 'rgba(0, 0, 0, 0)'
  ctx.shadowOffsetX = style.shadowOffsetX || 0
  ctx.shadowOffsetY = style.shadowOffsetY || 0
  ctx.shadowBlur = style.shadowBlur || 0
  ctx.strokeStyle = style.textStrokeColor || '#000'
  ctx.lineWidth = style.textStrokeWidth || 0
  ctx.fillStyle = style.color || '#000'
  ctx.textAlign = style.textAlign || 'start'
  ctx.fontKerning = style.fontKerning || 'normal'
  switch (style.verticalAlign) {
    case 'top':
    case 'middle':
    case 'bottom':
      ctx.textBaseline = style.verticalAlign
      break
    case 'baseline':
    default:
      ctx.textBaseline = 'alphabetic'
      break
  }
  ctx.font = [
    style.fontStyle || 'normal',
    style.fontWeight || 'normal',
    `${ style.fontSize || 14 }px`,
    style.fontFamily || 'sans-serif',
  ].join(' ')
  ;(ctx as any).letterSpacing = `${ style.letterSpacing || 0 }px`
}

export function canvasMeasureText(text: string, style: TextStyle) {
  const ctx = getCurrentCanvas().getContext('2d') as CanvasRenderingContext2D
  setContextStyle(ctx, {
    ...style,
    textAlign: 'center',
    verticalAlign: 'baseline',
  })
  const {
    width,
    actualBoundingBoxAscent: glyphAscent,
    actualBoundingBoxDescent: glyphDescent,
    actualBoundingBoxLeft: glyphLeft,
    actualBoundingBoxRight: glyphRight,
    fontBoundingBoxAscent: typoAscent,
    fontBoundingBoxDescent: typoDescent,
  } = ctx.measureText(text)
  const typoHeight = typoAscent + typoDescent
  const lineHeight = style.fontSize * style.lineHeight
  const glyphHeight = glyphAscent + glyphDescent
  const baseline = (lineHeight - typoHeight) / 2 + typoAscent
  return {
    typoAscent,
    typoDescent,
    width,
    height: style.fontSize,
    typoHeight,
    lineHeight,
    leading: lineHeight - typoHeight,
    glyphLeft,
    glyphRight,
    glyphAscent,
    glyphDescent,
    glyphWidth: glyphLeft + glyphRight,
    glyphHeight,
    baseline,
    centerX: glyphLeft,
  }
}
