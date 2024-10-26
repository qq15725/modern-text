import { uploadColor } from '../canvas'
import { Feature } from './Feature'

export interface Render2dOptions {
  pixelRatio: number
  ctx: CanvasRenderingContext2D
}

export class Renderer2D extends Feature {
  setupView(options: Render2dOptions): this {
    const { ctx, pixelRatio } = options
    const { renderBoundingBox } = this._text
    const { left, top, width, height } = renderBoundingBox
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
    return this
  }

  uploadColors(options: Pick<Render2dOptions, 'ctx'>): this {
    const { ctx } = options
    const { paragraphs, computedStyle: style, renderBoundingBox } = this._text
    uploadColor(style, renderBoundingBox, ctx)
    paragraphs.forEach((paragraph) => {
      uploadColor(paragraph.computedStyle, paragraph.boundingBox, ctx)
      paragraph.fragments.forEach((fragment) => {
        uploadColor(fragment.computedStyle, fragment.boundingBox, ctx)
      })
    })
    return this
  }

  fillBackground(options: Pick<Render2dOptions, 'ctx'>): this {
    const { ctx } = options
    const { computedStyle: style, paragraphs } = this._text
    function fillBackground(color: any, x: number, y: number, width: number, height: number): void {
      ctx.fillStyle = color
      ctx.fillRect(x, y, width, height)
    }
    if (style?.backgroundColor) {
      fillBackground(style.backgroundColor, 0, 0, ctx.canvas.width, ctx.canvas.height)
    }
    paragraphs.forEach((paragraph) => {
      if (paragraph.style?.backgroundColor) {
        fillBackground(paragraph.computedStyle.backgroundColor, ...paragraph.boundingBox.toArray())
      }
      paragraph.fragments.forEach((fragment) => {
        if (fragment.style?.backgroundColor) {
          fillBackground(fragment.computedStyle.backgroundColor, ...fragment.boundingBox.toArray())
        }
      })
    })
    return this
  }

  draw(options: Pick<Render2dOptions, 'ctx'>): this {
    const { ctx } = options
    const { characters } = this._text
    characters.forEach((character) => {
      character.drawTo(ctx)
    })
    return this
  }
}
