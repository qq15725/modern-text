import type { Path2D } from 'modern-path2d'
import type { TextEffect } from '../types'

export interface DrawShapePathsOptions extends Partial<TextEffect> {
  ctx: CanvasRenderingContext2D
  paths: Path2D[]
  fontSize: number
  fill?: boolean
}

export function drawPaths(options: DrawShapePathsOptions): void {
  const { ctx, paths, fontSize } = options

  paths.forEach((path) => {
    ctx.save()
    ctx.beginPath()
    const style = path.userData?.style ?? {}
    const fillStyle = options.color ?? style.fill ?? 'none'
    const strokeStyle = options.textStrokeColor ?? style.stroke ?? 'none'
    ctx.fillStyle = fillStyle !== 'none' ? fillStyle : '#000'
    ctx.strokeStyle = strokeStyle !== 'none' ? strokeStyle : '#000'
    ctx.lineWidth = options.textStrokeWidth
      ? options.textStrokeWidth * fontSize
      : style.strokeWidth
        ? style.strokeWidth * fontSize * 0.03
        : 0
    ctx.lineCap = style.strokeLineCap ?? 'round'
    ctx.lineJoin = style.strokeLineJoin ?? 'miter'
    ctx.miterLimit = style.strokeMiterLimit ?? 0
    ctx.shadowOffsetX = (options.shadowOffsetX ?? 0) * fontSize
    ctx.shadowOffsetY = (options.shadowOffsetY ?? 0) * fontSize
    ctx.shadowBlur = (options.shadowBlur ?? 0) * fontSize
    ctx.shadowColor = options.shadowColor ?? 'rgba(0, 0, 0, 0)'
    const offsetX = (options.offsetX ?? 0) * fontSize
    const offsetY = (options.offsetY ?? 0) * fontSize
    // { x: offsetX, y: offsetY }
    ctx.translate(offsetX, offsetY)
    path.drawTo(ctx)
    if (fillStyle !== 'none') {
      ctx.fill()
    }
    if (strokeStyle !== 'none') {
      ctx.stroke()
    }
    ctx.restore()
  })
}
