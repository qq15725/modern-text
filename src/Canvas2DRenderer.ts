import type {
  LinearGradientWithType,
  NormalizedFill,
  NormalizedOutline,
  NormalizedStyle,
  RadialGradientWithType,
} from 'modern-idoc'
import type { BoundingBox, Path2D, Path2DDrawStyle, Path2DStyle } from 'modern-path2d'
import type { Character } from './content'
import type { Text } from './Text'
import { isGradient, normalizeGradient } from 'modern-idoc'
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
    this.uploadColor(
      this.text.glyphBox,
      this.text.computedStyle,
      this.text.computedFill,
      this.text.computedOutline,
    )
    this.text.paragraphs.forEach((paragraph) => {
      this.uploadColor(
        paragraph.lineBox,
        paragraph.computedStyle,
        paragraph.computedFill,
        paragraph.computedOutline,
      )
      paragraph.fragments.forEach((fragment) => {
        this.uploadColor(
          fragment.inlineBox,
          fragment.computedStyle,
          fragment.computedFill,
          fragment.computedOutline,
        )
      })
    })
  }

  setup = (): this => {
    this._setupView()
    this._setupColors()
    return this
  }

  protected _parseColor = (
    source:
      | string
      | CanvasGradient
      | CanvasPattern
      | LinearGradientWithType
      | RadialGradientWithType,
    box: BoundingBox,
  ): string | CanvasGradient | CanvasPattern => {
    if (typeof source === 'string' && isGradient(source)) {
      source = normalizeGradient(source)[0]
    }

    if (typeof source === 'object' && 'type' in source) {
      switch (source.type) {
        case 'linear-gradient': {
          const { left, top, width: w, height: h } = box
          const { angle = 0, stops } = source
          const cx = left + w / 2
          const cy = top + h / 2
          const rad = (angle + 90) * Math.PI / 180
          const dx = Math.sin(rad)
          const dy = -Math.cos(rad)
          const l = Math.abs(w * Math.sin(rad)) + Math.abs(h * Math.cos(rad))
          const x0 = cx - dx * (l / 2)
          const y0 = cy - dy * (l / 2)
          const x1 = cx + dx * (l / 2)
          const y1 = cy + dy * (l / 2)
          const g = this.context.createLinearGradient(x0, y0, x1, y1)
          for (const s of stops) g.addColorStop(s.offset, s.color)
          return g
        }
        case 'radial-gradient':
          // TODO
          break
      }
    }

    return source as string | CanvasGradient | CanvasPattern
  }

  protected _uploadedStyles = [
    'color',
    'backgroundColor',
    'textStrokeColor',
  ]

  uploadColor = (
    box: BoundingBox,
    style: NormalizedStyle,
    fill?: NormalizedFill,
    outline?: NormalizedOutline,
  ): void => {
    this._uploadedStyles.forEach((key) => {
      ;(style as any)[key] = this._parseColor((style as any)[key], box) as any
    })

    if (fill) {
      if (fill.linearGradient) {
        ;(fill as any)._linearGradient = this._parseColor({
          type: 'linear-gradient',
          ...fill.linearGradient,
        }, box) as any
      }
    }

    if (outline) {
      if (outline.linearGradient) {
        ;(outline as any)._linearGradient = this._parseColor({
          type: 'radial-gradient',
          ...outline.linearGradient,
        }, box) as any
      }
    }
  }

  protected _mergePathStyle(path: Path2D, style: Partial<Path2DStyle>): Partial<Path2DStyle> {
    const {
      fontSize = this.text.computedStyle.fontSize,
    } = style

    const pathStyle = path.style
    const stroke = style.stroke ?? pathStyle.stroke
    const strokeWidth = style.strokeWidth
      ? style.strokeWidth * fontSize
      : pathStyle.strokeWidth

    return {
      ...pathStyle,
      ...style,
      fill: style.fill ?? pathStyle.fill,
      stroke: strokeWidth === undefined || strokeWidth > 0 ? stroke : undefined,
      strokeLinecap: style.strokeLinecap ?? pathStyle.strokeLinecap ?? 'round',
      strokeLinejoin: style.strokeLinejoin ?? pathStyle.strokeLinejoin ?? 'round',
      strokeWidth,
      shadowOffsetX: (style.shadowOffsetX ?? 0) * fontSize,
      shadowOffsetY: (style.shadowOffsetY ?? 0) * fontSize,
      shadowBlur: (style.shadowBlur ?? 0) * fontSize,
      shadowColor: style.shadowColor,
    }
  }

  drawPath = (
    path: Path2D,
    options: DrawShapePathsOptions = {},
  ): void => {
    const { clipRect } = options
    const ctx = this.context
    ctx.save()
    ctx.beginPath()
    if (clipRect) {
      ctx.rect(clipRect.left, clipRect.top, clipRect.width, clipRect.height)
      ctx.clip()
      ctx.beginPath()
    }
    path.drawTo(ctx, this._mergePathStyle(path, options))
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
      computedFill,
      computedOutline,
    } = character

    const style = {
      ...computedStyle,
      ...userStyle,
    }

    const pathStyle: Partial<Path2DStyle> = {
      strokeLinecap: computedOutline?.lineCap,
      strokeLinejoin: computedOutline?.lineJoin,
      ...style,
      fill: userStyle.color
        ?? (computedFill as any)?._linearGradient
        ?? computedFill?.color
        ?? computedStyle.color,
      strokeWidth: userStyle.textStrokeWidth
        ?? computedOutline?.width
        ?? computedStyle.textStrokeWidth,
      stroke: userStyle.textStrokeColor
        ?? (computedOutline as any)?._linearGradient
        ?? computedOutline?.color
        ?? computedStyle.textStrokeColor,
    }

    if (glyphBox) {
      this.drawPath(path, pathStyle as any)
    }
    else {
      ctx.save()
      ctx.beginPath()
      setCanvasContext(ctx, this._mergePathStyle(path, pathStyle))
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
