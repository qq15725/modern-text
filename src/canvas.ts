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
  if (style.shadowColor) ctx.shadowColor = style.shadowColor
  if (style.shadowOffsetX !== undefined) ctx.shadowOffsetX = style.shadowOffsetX
  if (style.shadowOffsetY !== undefined) ctx.shadowOffsetY = style.shadowOffsetY
  if (style.shadowBlur !== undefined) ctx.shadowBlur = style.shadowBlur
  if (style.textStrokeColor) ctx.strokeStyle = style.textStrokeColor
  if (style.textStrokeWidth !== undefined) ctx.lineWidth = style.textStrokeWidth
  if (style.color) ctx.fillStyle = style.color
  if (style.direction) ctx.direction = style.direction
  if (style.textAlign) ctx.textAlign = style.textAlign
  if (style.fontKerning) ctx.fontKerning = style.fontKerning
  switch (style.verticalAlign) {
    case 'baseline':
      ctx.textBaseline = 'alphabetic'
      break
    case 'top':
    case 'middle':
    case 'bottom':
      ctx.textBaseline = style.verticalAlign
      break
  }
  if (style.letterSpacing !== undefined) (ctx as any).letterSpacing = `${ style.letterSpacing }px`
  if (
    style.fontStyle
    || style.fontWeight !== undefined
    || style.fontSize !== undefined
    || style.fontFamily
  ) {
    ctx.font = [
      style.fontStyle || 'normal',
      style.fontWeight || 'normal',
      `${ style.fontSize || 14 }px`,
      style.fontFamily || 'sans-serif',
    ].join(' ')
  }
}

export function canvasMeasureText(text: string, style: TextStyle): TextMetrics {
  const ctx = getCurrentCanvas().getContext('2d') as CanvasRenderingContext2D
  setContextStyle(ctx, style)
  return ctx.measureText(text)
}
