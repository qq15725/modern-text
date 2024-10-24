import type { BoundingBox, Path2D } from 'modern-path2d'
import type { TextEffect } from '../types'
import { Matrix3 } from 'modern-path2d'

export interface DrawShapePathsOptions extends Partial<TextEffect> {
  ctx: CanvasRenderingContext2D
  path: Path2D
  fontSize: number
  clipRect?: BoundingBox
}

const _tempM1 = new Matrix3()
const _tempM2 = new Matrix3()

export function drawPath(options: DrawShapePathsOptions, isText = false): void {
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
  const skewX = (options.skewX ?? 0) / 180 * Math.PI
  const skewY = (options.skewY ?? 0) / 180 * Math.PI
  if (offsetX || offsetY || skewX || skewY) {
    _tempM1.makeTranslation(offsetX, offsetY)
    _tempM2.set(1, Math.tan(skewX), 0, Math.tan(skewY), 1, 0, 0, 0, 1)
    const [a, c, e, b, d, f] = _tempM1.multiply(_tempM2).transpose().elements
    ctx.transform(a, b, c, d, e, f)
  }
  if (clipRect) {
    ctx.rect(clipRect.x, clipRect.y, clipRect.width, clipRect.height)
    ctx.clip()
    ctx.beginPath()
  }
  // -webkit-text-stroke
  if (isText && path.style.strokeWidth) {
    const scale = path.style.strokeWidth / fontSize + 1
    const box = path.getBoundingBox()
    ctx.translate(
      box.left * (1 - scale) + box.width * (1 - scale) / 2,
      box.top * (1 - scale) + box.height * (1 - scale) / 2,
    )
    ctx.scale(scale, scale)
    const clone = path.clone()
    clone.style.strokeWidth! /= scale * 2
    clone.drawTo(ctx)
  }
  else {
    path.drawTo(ctx)
  }
  ctx.restore()
}
