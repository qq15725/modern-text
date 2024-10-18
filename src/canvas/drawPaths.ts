import type { Path2D } from 'modern-path2d'
import type { TextEffect } from '../types'

export interface DrawShapePathsOptions extends Partial<TextEffect> {
  ctx: CanvasRenderingContext2D
  paths: Path2D[]
  fontSize: number
}

export function drawPaths(options: DrawShapePathsOptions): void {
  const { ctx, paths, fontSize } = options

  paths.forEach((path) => {
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
    path.drawTo(ctx)
    ctx.restore()
  })
}
