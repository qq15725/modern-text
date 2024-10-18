import type { BoundingBox, Path2D } from 'modern-path2d'
import type { TextEffect } from '../types'

export interface DrawShapePathsOptions extends Partial<TextEffect> {
  ctx: CanvasRenderingContext2D
  path: Path2D
  fontSize: number
  clipRect?: BoundingBox
}

export function drawPath(options: DrawShapePathsOptions): void {
  const { ctx, path, fontSize, clipRect } = options

  ctx.save()
  ctx.beginPath()
  const style = path.style
  path.style = {
    ...style,
    fill: options.color ?? style.fill,
    stroke: options.textStrokeColor ?? style.stroke,
    strokeWidth: options.textStrokeWidth
      ? options.textStrokeWidth * fontSize
      : style.strokeWidth,
    shadowOffsetX: (options.shadowOffsetX ?? 0) * fontSize,
    shadowOffsetY: (options.shadowOffsetY ?? 0) * fontSize,
    shadowBlur: (options.shadowBlur ?? 0) * fontSize,
    shadowColor: options.shadowColor,
  }
  const offsetX = (options.offsetX ?? 0) * fontSize
  const offsetY = (options.offsetY ?? 0) * fontSize
  ctx.translate(offsetX, offsetY)
  if (clipRect) {
    ctx.rect(clipRect.x, clipRect.y, clipRect.width, clipRect.height)
    ctx.clip()
    ctx.beginPath()
  }
  path.drawTo(ctx)
  ctx.restore()
}
