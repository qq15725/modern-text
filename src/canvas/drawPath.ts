import type { BoundingBox, Path2D } from 'modern-path2d'
import type { TextEffect } from '../types'

export interface DrawShapePathsOptions extends Partial<TextEffect> {
  ctx: CanvasRenderingContext2D
  path: Path2D
  fontSize: number
  boldness?: number
  clipRect?: BoundingBox
}

export function drawPath(options: DrawShapePathsOptions): void {
  const { ctx, path, fontSize, boldness = 0, clipRect } = options

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

  if (boldness) {
    for (let offsetX = -boldness; offsetX <= boldness; offsetX += boldness / 2) {
      for (let offsetY = -boldness; offsetY <= boldness; offsetY += boldness / 2) {
        ctx.save()
        ctx.translate(Math.round(offsetX), Math.round(offsetY))
        path.drawTo(ctx, style)
        ctx.restore()
      }
    }
  }
  else {
    path.drawTo(ctx, style)
  }

  ctx.restore()
}
