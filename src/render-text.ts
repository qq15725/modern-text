import { measureText } from './measure-text'
import { setContextStyle } from './canvas'
import { parseColor } from './parse-color'
import { BoundingBox } from './bounding-box'
import type { MeasureTextOptions } from './measure-text'

export interface RenderTextOptions extends MeasureTextOptions {
  view?: HTMLCanvasElement
  pixelRatio?: number
}

export function renderText(options: RenderTextOptions) {
  const {
    view = document.createElement('canvas'),
    style: rawStyle,
    pixelRatio = 1,
  } = options
  const style = { ...rawStyle }
  const { box, viewBox, paragraphs } = measureText(options)
  const { x, y, width, height } = viewBox
  const ctx = view.getContext('2d')!
  const canvasWidth = -x + width
  const canvasHeight = -y + height
  view.style.width = `${ canvasWidth }px`
  view.style.height = `${ canvasHeight }px`
  view.dataset.width = String(box.width)
  view.dataset.height = String(box.height)
  view.dataset.pixelRatio = String(pixelRatio)
  view.width = Math.max(1, Math.floor(canvasWidth * pixelRatio))
  view.height = Math.max(1, Math.floor(canvasHeight * pixelRatio))
  ctx.scale(pixelRatio, pixelRatio)
  ctx.clearRect(0, 0, view.width, view.height)
  ctx.translate(-x, -y)

  const colorBox = new BoundingBox({ width, height })
  if (style?.color) style.color = parseColor(ctx, style.color, colorBox)
  if (style?.backgroundColor) style.backgroundColor = parseColor(ctx, style.backgroundColor, colorBox)
  if (style?.textStrokeColor) style.textStrokeColor = parseColor(ctx, style.textStrokeColor, colorBox)
  if (style?.backgroundColor) {
    ctx.fillStyle = style.backgroundColor
    ctx.fillRect(0, 0, view.width, view.height)
  }
  paragraphs.forEach(p => {
    if (p.style?.color) p.style.color = parseColor(ctx, p.style.color, p.contentBox)
    if (p.style?.backgroundColor) p.style.backgroundColor = parseColor(ctx, p.style.backgroundColor, p.contentBox)
    if (p.style?.textStrokeColor) p.style.textStrokeColor = parseColor(ctx, p.style.textStrokeColor, p.contentBox)
    if (p.style?.backgroundColor) {
      ctx.fillStyle = p.style.backgroundColor
      ctx.fillRect(p.lineBox.x, p.lineBox.y, p.lineBox.width, p.lineBox.height)
    }
    p.fragments.forEach(f => {
      if (f.style?.color) f.style.color = parseColor(ctx, f.style.color, f.contentBox)
      if (f.style?.backgroundColor) f.style.backgroundColor = parseColor(ctx, f.style.backgroundColor, f.contentBox)
      if (f.style?.textStrokeColor) f.style.textStrokeColor = parseColor(ctx, f.style.textStrokeColor, f.contentBox)
      if (f.style?.backgroundColor) {
        ctx.fillStyle = f.style.backgroundColor
        ctx.fillRect(f.inlineBox.x, f.inlineBox.y, f.inlineBox.width, f.inlineBox.height)
      }
    })
  })

  setContextStyle(ctx, style)
  paragraphs.forEach(p => {
    p.style && setContextStyle(ctx, p.style)
    p.fragments.forEach(f => {
      setContextStyle(ctx, {
        ...f.style,
        textAlign: 'left',
        verticalAlign: 'top',
      })
      const { x, y, width, height } = f.contentBox
      const fStyle = f.getComputedStyle()
      switch (fStyle.writingMode) {
        case 'vertical-rl':
        case 'vertical-lr': {
          let offset = 0
          for (const c of f.content) {
            if (fStyle.textStrokeWidth) ctx.strokeText(c, x, y + offset)
            ctx.fillText(c, x, y + offset)
            offset += fStyle.fontSize + fStyle.letterSpacing
          }
          break
        }
        case 'horizontal-tb':
          if (fStyle.textStrokeWidth) ctx.strokeText(f.content, x, y)
          ctx.fillText(f.content, x, y)
          break
      }
      switch (fStyle.textDecoration) {
        case 'underline':
          ctx.beginPath()
          ctx.moveTo(x, y + height - 2)
          ctx.lineTo(x + width, y + height - 2)
          ctx.stroke()
          break
        case 'line-through':
          ctx.beginPath()
          ctx.moveTo(x, y + height / 2)
          ctx.lineTo(x + width, y + height / 2)
          ctx.stroke()
          break
      }
    })
  })
  return view
}
