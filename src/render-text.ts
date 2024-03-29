import { measureText } from './measure-text'
import { setContextStyle } from './canvas'
import { parseColor } from './parse-color'
import { BoundingBox } from './bounding-box'
import type { TextDrawStyle } from './types'
import type { MeasureTextOptions } from './measure-text'

export interface RenderTextOptions extends MeasureTextOptions {
  view?: HTMLCanvasElement
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
    effects: userEffects = [],
    pixelRatio = 1,
  } = options
  const effects = userEffects.length > 0 ? userEffects : [{}]
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

  effects.forEach(effect => {
    const effectStyle = { ...effect }
    uploadColor(ctx, new BoundingBox({ width, height }), effectStyle)
    const style = { ...defaultStyle, ...effectStyle }

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
        const fStyle = { ...f.getComputedStyle(), ...effectStyle }
        setContextStyle(ctx, {
          ...fStyle,
          textAlign: 'left',
          verticalAlign: fStyle.writingMode === 'horizontal-tb' ? 'baseline' : 'top',
        })
        const { width, height } = f.contentBox
        let x = -viewBox.x
        let y = -viewBox.y
        if (effectStyle.offsetX) x += effectStyle.offsetX
        if (effectStyle.offsetY) y += effectStyle.offsetY
        const baseline = y + f.baseline
        x += f.contentBox.x
        y += f.contentBox.y
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
            ctx.fillText(f.content, x, baseline)
            if (fStyle.textStrokeWidth) ctx.strokeText(f.content, x, baseline)
            break
        }
        switch (fStyle.textDecoration) {
          case 'underline':
            ctx.strokeStyle = ctx.fillStyle
            ctx.lineWidth = fStyle.fontSize / 15
            ctx.beginPath()
            ctx.moveTo(x, y + height)
            ctx.lineTo(x + width, y + height)
            ctx.stroke()
            break
          case 'line-through':
            ctx.strokeStyle = ctx.fillStyle
            ctx.lineWidth = fStyle.fontSize / 15
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
