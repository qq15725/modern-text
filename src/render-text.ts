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

  const fillBackground = (color: any, x: number, y: number, width: number, height: number) => {
    ctx.fillStyle = color
    ctx.fillRect(-viewBox.x + x, -viewBox.y + y, width, height)
  }

  const defaultStyle = { ...userStyle }

  uploadColor(ctx, new BoundingBox(0, 0, width, height), defaultStyle)
  paragraphs.forEach(p => {
    uploadColor(ctx, p.contentBox, p.computedStyle)
    p.fragments.forEach(f => {
      uploadColor(ctx, f.contentBox, f.computedStyle)
    })
  })

  effects.forEach(effect => {
    const effectStyle = { ...effect }
    uploadColor(ctx, new BoundingBox(0, 0, width, height), effectStyle)
    const style = { ...defaultStyle, ...effectStyle }

    if (style?.backgroundColor) {
      fillBackground(style.backgroundColor, 0, 0, view.width, view.height)
    }
    paragraphs.forEach(p => {
      if (p.style?.backgroundColor) {
        fillBackground(p.computedStyle.backgroundColor, ...p.lineBox.toArray())
      }
      p.fragments.forEach(f => {
        if (f.style?.backgroundColor) {
          fillBackground(f.computedStyle.backgroundColor, ...f.inlineBox.toArray())
        }
      })
    })

    paragraphs.forEach(p => {
      p.fragments.forEach(f => {
        const tx = -viewBox.x + (effectStyle.offsetX ?? 0)
        const ty = -viewBox.y + (effectStyle.offsetY ?? 0)
        const fStyle = { ...f.computedStyle, ...effectStyle }
        setContextStyle(ctx, {
          ...fStyle,
          textAlign: 'left',
          verticalAlign: fStyle.writingMode === 'horizontal-tb' ? 'baseline' : 'top',
        })
        switch (fStyle.writingMode) {
          case 'vertical-rl':
          case 'vertical-lr': {
            f.characters.forEach(c => {
              const x = tx + c.contentBox.x
              const y = ty + c.contentBox.y
              switch (c.verticalOrientation) {
                case 'R':
                case 'Tr': {
                  ctx.translate(x + c.contentBox.width, y)
                  ctx.rotate(Math.PI / 2)
                  ctx.fillText(c.content, 0, 0)
                  if (fStyle.textStrokeWidth) ctx.strokeText(c.content, 0, 0)
                  ctx.setTransform(1, 0, 0, 1, 0, 0)
                  ctx.scale(pixelRatio, pixelRatio)
                  break
                }
                default:
                  ctx.fillText(c.content, x, y)
                  if (fStyle.textStrokeWidth) ctx.strokeText(c.content, x, y)
                  break
              }
            })
            break
          }
          case 'horizontal-tb': {
            const x = tx + f.contentBox.x
            const y = ty + f.contentBox.y
            const baseline = ty + f.baseline
            ctx.fillText(f.content, x, baseline)
            if (fStyle.textStrokeWidth) ctx.strokeText(f.content, x, baseline)
            const { width, height } = f.contentBox
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
            break
          }
        }
      })
    })
  })

  return view
}
