import type { NormalizedStyle } from 'modern-idoc'
import type { BoundingBox, Path2D, Path2DDrawStyle } from 'modern-path2d'
import type { Character } from './content'
import type { Text } from './Text'
import { isGradient, parseGradient } from 'modern-idoc'
import { setCanvasContext } from 'modern-path2d'

export interface DrawShapePathsOptions extends
  NormalizedStyle,
  Omit<Partial<Path2DDrawStyle>, 'fill' | 'outline'> {
  fontSize?: number
  clipRect?: BoundingBox
}

export class Canvas2DRenderer {
  pixelRatio = window?.devicePixelRatio || 1

  constructor(
    public text: Text,
    public context: CanvasRenderingContext2D,
  ) {
    //
  }

  protected _setupView = (): void => {
    const pixelRatio = this.pixelRatio
    const ctx = this.context
    const { left, top, width, height } = this.text.boundingBox
    const view = ctx.canvas
    view.dataset.viewBox = String(`${left} ${top} ${width} ${height}`)
    view.dataset.pixelRatio = String(pixelRatio)
    const canvasWidth = width
    const canvasHeight = height
    view.width = Math.max(1, Math.ceil(canvasWidth * pixelRatio))
    view.height = Math.max(1, Math.ceil(canvasHeight * pixelRatio))
    view.style.width = `${canvasWidth}px`
    view.style.height = `${canvasHeight}px`
    ctx.clearRect(0, 0, view.width, view.height)
    ctx.scale(pixelRatio, pixelRatio)
    ctx.translate(-left, -top)
  }

  protected _setupColors = (): void => {
    const { paragraphs, computedStyle, glyphBox } = this.text
    this.uploadColor(computedStyle, glyphBox)
    paragraphs.forEach((paragraph) => {
      this.uploadColor(paragraph.computedStyle, paragraph.lineBox)
      paragraph.fragments.forEach((fragment) => {
        this.uploadColor(fragment.computedStyle, fragment.inlineBox)
      })
    })
  }

  setup = (): this => {
    this._setupView()
    this._setupColors()
    return this
  }

  protected _parseColor = (
    source: string | CanvasGradient | CanvasPattern,
    box: BoundingBox,
  ): string | CanvasGradient | CanvasPattern => {
    if (typeof source === 'string' && isGradient(source)) {
      const gradient = parseGradient(source)[0]
      if (gradient) {
        switch (gradient.type) {
          case 'linear-gradient': {
            let deg = 0
            if (gradient.orientation) {
              switch (gradient.orientation.type) {
                case 'angular':
                  deg = Number(gradient.orientation.value)
                  break
              }
            }
            const { left, top, width, height } = box
            const rad = (deg * Math.PI) / 180
            const offsetX = width * Math.sin(rad)
            const offsetY = height * Math.cos(rad)
            const canvasGradient = this.context.createLinearGradient(
              left + width / 2 - offsetX,
              top + height / 2 + offsetY,
              left + width / 2 + offsetX,
              top + height / 2 - offsetY,
            )
            gradient.colorStops.forEach((colorStop) => {
              let offset = 0
              if (colorStop.length) {
                switch (colorStop.length.type) {
                  case '%':
                    offset = Number(colorStop.length.value) / 100
                    break
                }
              }
              switch (colorStop.type) {
                case 'rgb':
                  canvasGradient.addColorStop(offset, `rgb(${colorStop.value.join(', ')})`)
                  break
                case 'rgba':
                  canvasGradient.addColorStop(offset, `rgba(${colorStop.value.join(', ')})`)
                  break
              }
            })
            return canvasGradient
          }
          case 'radial-gradient':
            // TODO
            break
        }
      }
    }
    return source
  }

  protected _uploadedStyles = [
    'color',
    'backgroundColor',
    'textStrokeColor',
  ]

  uploadColor = (style: NormalizedStyle, box: BoundingBox): void => {
    this._uploadedStyles.forEach((key) => {
      ;(style as any)[key] = this._parseColor((style as any)[key], box) as any
    })
  }

  drawPath = (
    path: Path2D,
    options: DrawShapePathsOptions = {},
  ): void => {
    const ctx = this.context

    const {
      fontSize = this.text.computedStyle.fontSize,
      clipRect,
    } = options

    ctx.save()
    ctx.beginPath()

    if (clipRect) {
      ctx.rect(clipRect.left, clipRect.top, clipRect.width, clipRect.height)
      ctx.clip()
      ctx.beginPath()
    }

    const pathStyle = path.style
    path.drawTo(ctx, {
      ...pathStyle,
      fill: options.color ?? pathStyle.fill,
      stroke: options.textStrokeColor ?? pathStyle.stroke,
      strokeWidth: options.textStrokeWidth
        ? options.textStrokeWidth * fontSize
        : pathStyle.strokeWidth,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      shadowOffsetX: (options.shadowOffsetX ?? 0) * fontSize,
      shadowOffsetY: (options.shadowOffsetY ?? 0) * fontSize,
      shadowBlur: (options.shadowBlur ?? 0) * fontSize,
      shadowColor: options.shadowColor,
    })

    ctx.restore()
  }

  drawCharacter = (
    character: Character,
    userStyle: NormalizedStyle = {},
  ): void => {
    const ctx = this.context

    const {
      computedStyle,
      path,
      glyphBox,
      isVertical,
      content,
      inlineBox,
      baseline,
    } = character

    const style = {
      ...computedStyle,
      ...userStyle,
    }

    if (glyphBox) {
      this.drawPath(path, style)
    }
    else {
      ctx.save()
      ctx.beginPath()
      const pathStyle = path.style
      setCanvasContext(ctx, {
        ...pathStyle,
        fill: style.color ?? pathStyle.fill,
        stroke: style.textStrokeColor ?? pathStyle.stroke,
        strokeWidth: style.textStrokeWidth
          ? style.textStrokeWidth * style.fontSize
          : pathStyle.strokeWidth,
        shadowOffsetX: (style.shadowOffsetX ?? 0) * style.fontSize,
        shadowOffsetY: (style.shadowOffsetY ?? 0) * style.fontSize,
        shadowBlur: (style.shadowBlur ?? 0) * style.fontSize,
        shadowColor: style.shadowColor,
      })
      ctx.font = `${style.fontSize}px ${style.fontFamily}`
      if (isVertical) {
        ctx.textBaseline = 'middle'
        ctx.fillText(content, inlineBox.left, inlineBox.top + inlineBox.height / 2)
      }
      else {
        ctx.textBaseline = 'alphabetic'
        ctx.fillText(content, inlineBox.left, inlineBox.top + baseline)
      }
      ctx.restore()
    }
  }
}
