import { measureText } from './measure-text'
import { setContextStyle } from './canvas'
import { parseColor } from './parse-color'
import { BoundingBox } from './bounding-box'
import type { TextDrawStyle } from './types'
import type { MeasureTextOptions } from './measure-text'

export type RenderTextDraws = Array<Partial<TextDrawStyle & { offsetX: number; offsetY: number }>>

export interface RenderTextOptions extends MeasureTextOptions {
  view?: HTMLCanvasElement
  draws?: RenderTextDraws
  pixelRatio?: number
}

function uploadColor(ctx: CanvasRenderingContext2D, box: BoundingBox, style?: Partial<TextDrawStyle>) {
  if (style?.color) style.color = parseColor(ctx, style.color, box)
  if (style?.backgroundColor) style.backgroundColor = parseColor(ctx, style.backgroundColor, box)
  if (style?.textStrokeColor) style.textStrokeColor = parseColor(ctx, style.textStrokeColor, box)
}

export function renderText(options: RenderTextOptions) {
  const {
    view = document.createElement('canvas'),
    style: userStyle,
    draws: userDraws = [],
    pixelRatio = 1,
  } = options
  const draws = userDraws.length > 0 ? userDraws : [{}]
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

  const defaultStyle = { ...userStyle }

  uploadColor(ctx, new BoundingBox({ width, height }), defaultStyle)
  paragraphs.forEach(p => {
    uploadColor(ctx, p.contentBox, p.style)
    p.fragments.forEach(f => {
      uploadColor(ctx, f.contentBox, f.style)
    })
  })

  draws.forEach(userDrawStyle => {
    const drawStyle = { ...userDrawStyle }
    uploadColor(ctx, new BoundingBox({ width, height }), drawStyle)
    const style = { ...defaultStyle, ...drawStyle }

    if (style?.backgroundColor) {
      ctx.fillStyle = style.backgroundColor
      ctx.fillRect(0, 0, view.width, view.height)
    }
    paragraphs.forEach(p => {
      if (p.style?.backgroundColor) {
        ctx.fillStyle = p.style.backgroundColor
        ctx.fillRect(p.lineBox.x, p.lineBox.y, p.lineBox.width, p.lineBox.height)
      }
      p.fragments.forEach(f => {
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
        // eslint-disable-next-line prefer-const
        let { x, y, width, height } = f.contentBox
        if (drawStyle.offsetX) x += drawStyle.offsetX
        if (drawStyle.offsetY) y += drawStyle.offsetY
        const fStyle = { ...f.getComputedStyle(), ...drawStyle }
        switch (fStyle.writingMode) {
          case 'vertical-rl':
          case 'vertical-lr': {
            let offset = 0
            for (const c of f.content) {
              ctx.fillText(c, x, y + offset)
              if (fStyle.textStrokeWidth) ctx.strokeText(c, x, y + offset)
              offset += fStyle.fontSize + fStyle.letterSpacing
            }
            break
          }
          case 'horizontal-tb':
            ctx.fillText(f.content, x, y)
            if (fStyle.textStrokeWidth) ctx.strokeText(f.content, x, y)
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
  })

  return view
}
