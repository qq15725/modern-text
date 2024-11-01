import type { BoundingBox } from '../lib'

export function setupView(ctx: CanvasRenderingContext2D, pixelRatio: number, boundingBox: BoundingBox): void {
  const { left, top, width, height } = boundingBox
  const view = ctx.canvas
  view.dataset.viewbox = String(`${left} ${top} ${width} ${height}`)
  view.dataset.pixelRatio = String(pixelRatio)
  view.width = Math.max(1, Math.ceil(width * pixelRatio))
  view.height = Math.max(1, Math.ceil(height * pixelRatio))
  view.style.marginTop = `${top}px`
  view.style.marginLeft = `${left}px`
  view.style.width = `${width}px`
  view.style.height = `${height}px`
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
  ctx.scale(pixelRatio, pixelRatio)
  ctx.translate(-left, -top)
}
