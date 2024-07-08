import { measureText } from './measureText'
import { setContextStyle } from './setContextStyle'
import { parseColor } from './parseColor'
import { BoundingBox } from './BoundingBox'
import type { TextDrawStyle } from './types'
import type { MeasureTextOptions } from './measureText'

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
          fontSize: fStyle.fontSize * pixelRatio,
          letterSpacing: fStyle.letterSpacing * pixelRatio,
          textStrokeWidth: fStyle.textStrokeWidth * pixelRatio,
          shadowOffsetX: fStyle.shadowOffsetX * pixelRatio,
          shadowOffsetY: fStyle.shadowOffsetY * pixelRatio,
          shadowBlur: fStyle.shadowBlur * pixelRatio,
          textAlign: 'left',
        })
        switch (fStyle.writingMode) {
          case 'vertical-rl':
          case 'vertical-lr': {
            f.characters.forEach(c => {
              ctx.setTransform(1, 0, 0, 1, 0, 0)
              let x = 0
              let y = 0
              switch (c.verticalOrientation) {
                case 'Tr':
                case 'R': {
                  ctx.rotate(Math.PI / 2)
                  ctx.textBaseline = 'alphabetic'
                  y = -(tx + f.inlineBox.x + f.inlineBox.width - c.baseline)
                  x = ty + c.contentBox.y
                  break
                }
                case 'Tu':
                  ctx.textBaseline = 'top'
                  x = tx + c.contentBox.x + c.contentBox.right - c.glyphBox.right
                  y = ty + c.contentBox.y + c.contentBox.y - c.glyphBox.y
                  break
                case 'U':
                  x = tx + c.contentBox.x
                  y = ty + c.contentBox.y
                  ctx.textBaseline = 'top'
                  break
              }
              ctx.fillText(c.content, x * pixelRatio, y * pixelRatio)
              if (fStyle.textStrokeWidth) ctx.strokeText(c.content, x * pixelRatio, y * pixelRatio)
            })
            break
          }
          case 'horizontal-tb': {
            const x = tx + f.contentBox.x
            const y = ty + f.contentBox.y
            const baseline = ty + f.inlineBox.y + f.baseline
            const { width, height } = f.contentBox
            ctx.textBaseline = 'alphabetic'
            ctx.setTransform(1, 0, 0, 1, 0, 0)
            ctx.fillText(f.computedContent, x * pixelRatio, baseline * pixelRatio)
            if (fStyle.textStrokeWidth) ctx.strokeText(f.computedContent, x * pixelRatio, baseline * pixelRatio)
            ctx.scale(pixelRatio, pixelRatio)
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
