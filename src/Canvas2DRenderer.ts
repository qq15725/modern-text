import type {
  LinearGradientWithType,
  NormalizedEffect,
  NormalizedFill,
  NormalizedOutline,
  NormalizedShadow,
  NormalizedStyle,
  RadialGradientWithType,
} from 'modern-idoc'
import type { BoundingBox, Path2D, Path2DStyle } from 'modern-path2d'
import type { Character } from './content'
import type { Text } from './Text'
import { clearUndef, isGradient, normalizeGradient } from 'modern-idoc'
import { setCanvasContext } from 'modern-path2d'
import { getEffectTransform2D } from './utils'

export interface DrawShapePathsOptions extends Partial<Path2DStyle> {
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
    this.uploadColor(this.text.glyphBox, {
      style: this.text.computedStyle,
      fill: this.text.computedFill,
      outline: this.text.computedOutline,
    })
    this.text.paragraphs.forEach((paragraph) => {
      this.uploadColor(paragraph.lineBox, {
        style: paragraph.computedStyle,
        fill: paragraph.computedFill,
        outline: paragraph.computedOutline,
      })
      paragraph.fragments.forEach((fragment) => {
        this.uploadColor(fragment.inlineBox, {
          style: fragment.computedStyle,
          fill: fragment.computedFill,
          outline: fragment.computedOutline,
        })
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
          // box/angle 非有限（如自定义字体未就绪时文字测量为 NaN）会让 createLinearGradient 抛错、
          // 崩掉整个文本渲染；退化为首个有效色标的纯色，待重绘尺寸正常后再走渐变
          if (![left, top, w, h, angle].every(Number.isFinite)) {
            return stops?.find(s => s?.color)?.color ?? 'transparent'
          }
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
          for (const s of stops) {
            // 非法 offset/color 跳过单个色标，避免崩掉整张渐变
            const offset = Number.isFinite(s.offset) ? Math.min(1, Math.max(0, s.offset)) : 0
            try {
              g.addColorStop(offset, s.color)
            }
            catch {}
          }
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
    ctx: {
      style?: NormalizedStyle
      fill?: NormalizedFill
      outline?: NormalizedOutline
    },
  ): void => {
    const { style, fill, outline } = ctx

    if (style) {
      this._uploadedStyles.forEach((key) => {
        ;(style as any)[key] = this._parseColor((style as any)[key], box) as any
      })
    }

    if (fill?.enabled) {
      if (fill.linearGradient) {
        ;(fill as any)._linearGradient = this._parseColor({
          type: 'linear-gradient',
          ...fill.linearGradient,
        }, box) as any
      }
    }

    if (outline?.enabled) {
      if (outline.linearGradient) {
        ;(outline as any)._linearGradient = this._parseColor({
          type: 'linear-gradient',
          ...outline.linearGradient,
        }, box) as any
      }
    }
  }

  protected _mergePathStyle(path: Path2D, style: Partial<Path2DStyle>): Partial<Path2DStyle> {
    const pathStyle = path.style
    const stroke = style.stroke ?? pathStyle.stroke
    const strokeWidth = style.strokeWidth
      ? style.strokeWidth
      : pathStyle.strokeWidth

    return {
      ...clearUndef(pathStyle),
      ...clearUndef(style),
      stroke: strokeWidth === undefined || strokeWidth > 0 ? stroke : undefined,
      strokeLinecap: style.strokeLinecap ?? pathStyle.strokeLinecap ?? 'round',
      strokeLinejoin: style.strokeLinejoin ?? pathStyle.strokeLinejoin ?? 'round',
      strokeWidth,
    }
  }

  drawPath = (
    path: Path2D,
    options: DrawShapePathsOptions = {},
  ): void => {
    const { clipRect, ...pathStyle } = options
    const ctx = this.context
    ctx.save()
    ctx.beginPath()
    if (clipRect) {
      ctx.rect(clipRect.left, clipRect.top, clipRect.width, clipRect.height)
      ctx.clip()
      ctx.beginPath()
    }
    path.drawTo(ctx, this._mergePathStyle(path, pathStyle))
    ctx.restore()
  }

  effectToPathStyle(effect: NormalizedEffect): Partial<Path2DStyle> {
    const fontSize = this.text.computedStyle.fontSize

    let style: Partial<Path2DStyle> = {}

    if (effect.fill?.enabled) {
      style = {
        ...style,
        fill: effect.fill.color,
      }
    }

    if (effect.outline?.enabled) {
      style = {
        ...style,
        stroke: effect.outline.color,
        strokeWidth: (effect.outline.width ?? 0) * fontSize,
      }
    }

    if (effect.shadow?.enabled) {
      style = {
        ...style,
        shadowOffsetX: (effect.shadow.offsetX ?? 0) * fontSize,
        shadowOffsetY: (effect.shadow.offsetY ?? 0) * fontSize,
        shadowBlur: (effect.shadow.blur ?? 0) * fontSize,
        shadowColor: effect.shadow.color,
      }
    }

    return style
  }

  transformEffect(effect: NormalizedEffect): void {
    const { a, b, c, d, tx, ty } = getEffectTransform2D(this.text, effect)
    this.context.transform(a, b, c, d, tx, ty)
  }

  protected _shadowCanvas?: HTMLCanvasElement
  protected _shadowCtx?: CanvasRenderingContext2D | null

  drawWithShadow = (shadow: NormalizedShadow, drawFn: () => void): void => {
    const mainCtx = this.context
    const view = mainCtx.canvas

    if (!this._shadowCanvas) {
      this._shadowCanvas = document.createElement('canvas')
      this._shadowCtx = this._shadowCanvas.getContext('2d')
    }
    const off = this._shadowCanvas
    const offCtx = this._shadowCtx
    if (!offCtx) {
      drawFn()
      return
    }

    // Grow-only — avoid reallocating the backing store on every frame.
    if (off.width < view.width) {
      off.width = view.width
    }
    if (off.height < view.height) {
      off.height = view.height
    }

    offCtx.setTransform(1, 0, 0, 1, 0, 0)
    offCtx.clearRect(0, 0, view.width, view.height)
    const m = mainCtx.getTransform()
    offCtx.setTransform(m.a, m.b, m.c, m.d, m.e, m.f)

    const prev = this.context
    this.context = offCtx
    try {
      drawFn()
    }
    finally {
      this.context = prev
    }

    const fontSize = this.text.computedStyle.fontSize
    const pr = this.pixelRatio
    mainCtx.save()
    mainCtx.setTransform(1, 0, 0, 1, 0, 0)
    mainCtx.shadowOffsetX = (shadow.offsetX ?? 0) * fontSize * pr
    mainCtx.shadowOffsetY = (shadow.offsetY ?? 0) * fontSize * pr
    mainCtx.shadowBlur = (shadow.blur ?? 0) * fontSize * pr
    mainCtx.shadowColor = shadow.color as unknown as string
    mainCtx.drawImage(off, 0, 0, view.width, view.height, 0, 0, view.width, view.height)
    mainCtx.restore()
  }

  drawCharacter = (
    character: Character,
    effect: NormalizedEffect = {},
  ): void => {
    const ctx = this.context

    const {
      computedStyle: style,
      path,
      glyphBox,
      isVertical,
      content,
      inlineBox,
      baseline,
      computedFill,
      computedOutline,
    } = character

    const fill = computedFill?.enabled
      ? computedFill
      : undefined

    const outline = computedOutline?.enabled
      ? computedOutline
      : undefined

    const effectPathStyle = this.effectToPathStyle(effect)

    const pathStyle: Partial<Path2DStyle> = {
      strokeLinecap: outline?.lineCap,
      strokeLinejoin: outline?.lineJoin,
      ...style,
      ...effectPathStyle,
      fill: effectPathStyle.fill
        ?? (fill as any)?._linearGradient
        ?? fill?.color
        ?? style.color,
      strokeWidth: effectPathStyle.strokeWidth
        ?? outline?.width
        ?? style.textStrokeWidth,
      stroke: effectPathStyle.stroke
        ?? (outline as any)?._linearGradient
        ?? outline?.color
        ?? style.textStrokeColor,
    }

    if (glyphBox) {
      this.drawPath(path, pathStyle)
    }
    else {
      ctx.save()
      ctx.beginPath()
      setCanvasContext(ctx, this._mergePathStyle(path, pathStyle))
      ctx.font = `${style.fontSize}px ${style.fontFamily || this.text.defaultFamily}`
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
