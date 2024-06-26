import type { TextStyle } from './types'

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
