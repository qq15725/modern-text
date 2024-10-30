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
  const pathStyle = path.style
  const style = {
    ...pathStyle,
    fill: options.color ?? pathStyle.fill,
    stroke: options.textStrokeColor ?? pathStyle.stroke,
    strokeWidth: options.textStrokeWidth
      ? options.textStrokeWidth * fontSize
      : pathStyle.strokeWidth,
    shadowOffsetX: (options.shadowOffsetX ?? 0) * fontSize,
    shadowOffsetY: (options.shadowOffsetY ?? 0) * fontSize,
    shadowBlur: (options.shadowBlur ?? 0) * fontSize,
    shadowColor: options.shadowColor,
  }
  if (clipRect) {
    ctx.rect(clipRect.left, clipRect.top, clipRect.width, clipRect.height)
    ctx.clip()
    ctx.beginPath()
  }
  path.drawTo(ctx, style)
  ctx.restore()
}
