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
  const { viewBox, paragraphs } = measureText(options)
  const { x, y, width, height } = viewBox
  const ctx = view.getContext('2d')!
  view.style.width = `${ width }px`
  view.style.height = `${ height }px`
  view.dataset.viewbox = String(`${ x } ${ y } ${ width } ${ height }`)
  view.dataset.pixelRatio = String(pixelRatio)
  view.width = Math.max(1, Math.floor(width * pixelRatio))
  view.height = Math.max(1, Math.floor(height * pixelRatio))
  ctx.scale(pixelRatio, pixelRatio)
  ctx.clearRect(0, 0, view.width, view.height)

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

    paragraphs.forEach(p => {
      p.fragments.forEach(f => {
        const fStyle = { ...f.getComputedStyle(), ...drawStyle }
        setContextStyle(ctx, {
          ...fStyle,
          textAlign: 'left',
          verticalAlign: 'baseline',
        })
        const { width, height } = f.contentBox
        let x = -viewBox.x
        let y = -viewBox.y
        switch (fStyle.writingMode) {
          case 'vertical-rl':
          case 'vertical-lr':
            x += f.contentBox.x
            y += (fStyle.fontSize - p.xHeight) / 2 + p.xHeight + 1
            break
          case 'horizontal-tb':
            x += f.contentBox.x
            y += f.baseline
            break
        }
        if (drawStyle.offsetX) x += drawStyle.offsetX
        if (drawStyle.offsetY) y += drawStyle.offsetY
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
