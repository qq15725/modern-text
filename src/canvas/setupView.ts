import type { BoundingBox } from 'modern-path2d'

export function setupView(ctx: CanvasRenderingContext2D, pixelRatio: number, boundingBox: BoundingBox): void {
  const { left, top, width, height } = boundingBox
  const view = ctx.canvas
  view.dataset.viewBox = String(`${left} ${top} ${width} ${height}`)
  view.dataset.pixelRatio = String(pixelRatio)
  const canvasWidth = width + Math.abs(left)
  const canvasHeight = height + Math.abs(top)
  view.width = Math.max(1, Math.ceil(canvasWidth * pixelRatio))
  view.height = Math.max(1, Math.ceil(canvasHeight * pixelRatio))
  view.style.width = `${canvasWidth}px`
  view.style.height = `${canvasHeight}px`
  ctx.clearRect(0, 0, view.width, view.height)
  ctx.scale(pixelRatio, pixelRatio)
  ctx.translate(-Math.min(0, left), -Math.min(0, top))
}
