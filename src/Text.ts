export type FontWeight = 'normal' | 'bold' | 'lighter' | 'bolder' | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900
export type FontStyle = 'normal' | 'italic' | 'oblique' | `oblique ${ string }`
export type FontKerning = 'auto' | 'none' | 'normal'
export type TextWrap = 'wrap' | 'nowrap'
export type TextAlign = 'center' | 'end' | 'left' | 'right' | 'start'
export type TextBaseline = 'alphabetic' | 'bottom' | 'hanging' | 'ideographic' | 'middle' | 'top'
export type TextDecoration = 'underline' | 'line-through'

export interface TextParagraph {
  width: number
  height: number
  relativeX: number
  relativeY: number
  absoluteX: number
  absoluteY: number
  fragments: Array<TextFragment>
}

export interface TextFragment {
  width: number
  height: number
  actualBoundingBoxWidth: number
  relativeX: number
  relativeY: number
  absoluteX: number
  absoluteY: number
  fillX: number
  fillY: number
  data: string
  style: TextFragmentStyle
}

export interface TextFragmentStyle {
  color: string
  backgroundColor?: string
  fontSize: number
  fontWeight: FontWeight
  fontFamily: string
  fontStyle: FontStyle
  fontKerning: FontKerning
  textWrap: TextWrap
  textAlign: TextAlign
  textBaseline: TextBaseline
  textDecoration: TextDecoration | null
  textStrokeWidth: number
  textStrokeColor: string
  direction: 'inherit' | 'ltr' | 'rtl'
  lineHeight: number
  letterSpacing: number
  shadowColor: string
  shadowOffsetX: number
  shadowOffsetY: number
  shadowBlur: number
}

export interface TextStyle extends TextFragmentStyle {
  width: number | 'auto'
  height: number | 'auto'
}

export interface TextParagraphWithDataAndStyle extends Partial<TextFragmentStyle> {
  data: string
}

export interface TextParagraphWithFragmentsAndStyle extends Partial<TextFragmentStyle> {
  fragments: Array<TextFragmentWithStyle>
}

export interface TextFragmentWithStyle extends Partial<TextFragmentStyle> {
  data: string
}

export type TextData =
  | string
  | TextParagraphWithDataAndStyle | TextParagraphWithFragmentsAndStyle
  | Array<TextParagraphWithDataAndStyle | TextParagraphWithFragmentsAndStyle>

export interface TextOptions {
  view?: HTMLCanvasElement
  pixelRatio?: number
  data?: TextData
  style?: Partial<TextStyle>
}

export interface MeasureResult {
  x: number
  y: number
  width: number
  height: number
  paragraphs: Array<TextParagraph>
}

export class Text {
  static get defaultStyle(): TextStyle {
    return {
      width: 'auto',
      height: 'auto',
      color: '#000000',
      fontSize: 14,
      fontWeight: 'normal',
      fontFamily: 'sans-serif',
      fontStyle: 'normal',
      fontKerning: 'normal',
      textWrap: 'wrap',
      textAlign: 'start',
      textBaseline: 'middle',
      textDecoration: null,
      textStrokeWidth: 0,
      textStrokeColor: '#000000',
      direction: 'inherit',
      lineHeight: 1,
      letterSpacing: 0,
      shadowColor: '#000000',
      shadowOffsetX: 0,
      shadowOffsetY: 0,
      shadowBlur: 0,
    }
  }

  readonly view: HTMLCanvasElement
  readonly context: CanvasRenderingContext2D
  pixelRatio: number
  style: TextStyle
  data: TextData

  constructor(options: TextOptions = {}) {
    const {
      view = document.createElement('canvas'),
      pixelRatio = window.devicePixelRatio || 1,
      data = '',
      style,
    } = options

    this.view = view
    this.context = view.getContext('2d')!
    this.pixelRatio = pixelRatio
    this.data = data
    this.style = {
      ...Text.defaultStyle,
      ...style,
    }
    this.update()
  }

  measure(width = 0, height = 0): MeasureResult {
    let paragraphs = this._createParagraphs(this.data)
    paragraphs = this._createWrapedParagraphs(paragraphs, width)
    const context = this.context
    let offsetY = 0
    for (let len = paragraphs.length, i = 0; i < len; i++) {
      const paragraph = paragraphs[i]
      paragraph.relativeX = 0
      paragraph.relativeY = offsetY
      paragraph.width = 0
      paragraph.height = 0
      let offsetX = 0
      let lastFragment: TextFragment | undefined
      for (const fragment of paragraph.fragments) {
        const style = fragment.style
        this._setContextStyle(style)
        const result = context.measureText(fragment.data)
        const fragmentWidth = result.width
        const actualBoundingBoxWidth = result.actualBoundingBoxRight + result.actualBoundingBoxLeft
        fragment.relativeX = offsetX
        fragment.relativeY = paragraph.relativeY
        fragment.width = fragmentWidth
        fragment.actualBoundingBoxWidth = actualBoundingBoxWidth
        if (fragment.data.match(/^\s$/)) {
          fragment.height = 0
        } else {
          fragment.height = style.fontSize * style.lineHeight
        }
        offsetX += fragmentWidth + style.letterSpacing
        lastFragment = fragment
        paragraph.height = Math.max(paragraph.height, fragment.height)
      }
      paragraph.width = lastFragment
        ? lastFragment.relativeX + Math.max(lastFragment.width, lastFragment.actualBoundingBoxWidth)
        : 0
      offsetY += paragraph.height
    }

    const boundingRect = paragraphs.reduce((rect, paragraph) => {
      rect.x = Math.min(rect.x, paragraph.relativeX)
      rect.y = Math.min(rect.y, paragraph.relativeY)
      rect.width = Math.max(rect.width, paragraph.width)
      rect.height += paragraph.height
      return rect
    }, { x: 0, y: 0, width: 0, height: 0 })

    width = width || boundingRect.width
    height = Math.max(height, boundingRect.height)

    for (let len = paragraphs.length, i = 0; i < len; i++) {
      const paragraph = paragraphs[i]

      switch (this.style.textAlign) {
        case 'center':
          paragraph.absoluteX = (width - boundingRect.width) / 2
          paragraph.fragments.forEach(fragment => {
            fragment.absoluteX = paragraph.absoluteX + fragment.relativeX
            fragment.fillX = fragment.absoluteX + fragment.width / 2
          })
          break
        case 'end':
        case 'right':
          paragraph.absoluteX = width - boundingRect.width
          paragraph.fragments.forEach(fragment => {
            fragment.absoluteX = paragraph.absoluteX + fragment.relativeX
            fragment.fillX = fragment.absoluteX + fragment.width
          })
          break
        case 'start':
        case 'left':
        default:
          paragraph.absoluteX = 0
          paragraph.fragments.forEach(fragment => {
            fragment.absoluteX = paragraph.absoluteX + fragment.relativeX
            fragment.fillX = fragment.absoluteX
          })
          break
      }

      const diffHeight = height - boundingRect.height

      switch (this.style.textBaseline) {
        case 'bottom':
          paragraph.absoluteY = paragraph.relativeY + diffHeight
          paragraph.fragments.forEach(fragment => {
            fragment.absoluteY = paragraph.absoluteY + (paragraph.height - fragment.height)
            fragment.fillY = fragment.absoluteY + fragment.height
          })
          break
        case 'middle':
        case 'alphabetic':
        case 'ideographic':
          paragraph.absoluteY = paragraph.relativeY + diffHeight / 2
          paragraph.fragments.forEach(fragment => {
            fragment.absoluteY = paragraph.absoluteY + (paragraph.height - fragment.height) / 2
            fragment.fillY = fragment.absoluteY + fragment.height / 2
          })
          break
        case 'top':
        case 'hanging':
        default:
          paragraph.absoluteY = paragraph.relativeY
          paragraph.fragments.forEach(fragment => fragment.fillY = fragment.absoluteY = paragraph.absoluteY)
          break
      }
    }

    return { ...boundingRect, paragraphs }
  }

  protected _createParagraphs(data: TextData): Array<TextParagraph> {
    const shared = {
      width: 0,
      height: 0,
      actualBoundingBoxWidth: 0,
      relativeX: 0,
      relativeY: 0,
      absoluteX: 0,
      absoluteY: 0,
    }

    const createTextParagraph = (props: Record<string, any> = {}): TextParagraph => {
      return { ...shared, fragments: [], ...props } as any
    }

    const createTextFragments = (props: Record<string, any> = {}): Array<TextFragment> => {
      const fragments: Array<TextFragment> = []
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { width: _width, height: _height, ...style } = this.style
      fragments.push({
        fillX: 0,
        fillY: 0,
        ...shared,
        ...props,
        style: {
          ...style,
          ...props.style,
        },
        data: props.data ?? '',
      })
      return fragments
    }

    const paragraphs: Array<TextParagraph> = []
    if (typeof data === 'string') {
      paragraphs.push(createTextParagraph({ fragments: createTextFragments({ data }) }))
    } else {
      data = Array.isArray(data) ? data : [data]
      for (const p of data) {
        const paragraph = createTextParagraph()
        if ('fragments' in p) {
          const { fragments, ...pStyle } = p
          for (const f of fragments) {
            const { data: fData, ...fStyle } = f
            paragraph.fragments.push(...createTextFragments({ data: fData, style: { ...pStyle, ...fStyle } }))
          }
        } else if ('data' in p) {
          const { data: pData, ...pStyle } = p
          paragraph.fragments.push(...createTextFragments({ data: pData, style: pStyle }))
        }
        paragraphs.push(paragraph)
      }
    }
    return paragraphs
  }

  protected _createWrapedParagraphs(
    paragraphs: Array<TextParagraph>,
    width: number,
  ): Array<TextParagraph> {
    const wrapedParagraphs: Array<TextParagraph> = []
    const restParagraphs = paragraphs.slice()
    let paragraph: TextParagraph | undefined
    let fragment: TextFragment | undefined
    // eslint-disable-next-line no-cond-assign
    while (paragraph = restParagraphs.shift()) {
      const restFragments = paragraph.fragments.slice()
      let paragraphWidth = 0
      const fragments = []
      let first = true
      // eslint-disable-next-line no-cond-assign
      while (fragment = restFragments.shift()) {
        const style = fragment.style
        this._setContextStyle(style)
        let text = ''
        let wrap = false
        for (const char of fragment.data) {
          const charWidth = this.context!.measureText(char).width + (first ? 0 : style.letterSpacing)
          const isNewline = /^[\r\n]$/.test(char)
          if (
            isNewline
            || (
              style.textWrap === 'wrap'
              && width
              && paragraphWidth + charWidth > width
            )
          ) {
            let pos = isNewline ? text.length + 1 : text.length
            if (!paragraphWidth && !pos) {
              text += char
              pos++
            }
            if (text.length) fragments.push({ ...fragment, text })
            if (fragments.length) {
              wrapedParagraphs.push({ ...paragraph, fragments: fragments.slice() })
              fragments.length = 0
            }
            const restText = fragment.data.substring(pos)
            if (restText.length || restFragments.length) {
              restParagraphs.unshift({
                ...paragraph,
                fragments: (
                  restText.length
                    ? [{ ...fragment, data: restText }]
                    : []
                ).concat(restFragments.slice()),
              })
            }
            restFragments.length = 0
            wrap = true
            break
          } else {
            paragraphWidth += charWidth
          }
          text += char
        }
        if (!wrap) fragments.push({ ...fragment })
        first = false
      }
      if (fragments.length) {
        wrapedParagraphs.push({ ...paragraph, fragments })
      }
    }
    return wrapedParagraphs
  }

  protected _draw(paragraphs: Array<TextParagraph>) {
    const context = this.context!
    if (this.style.backgroundColor) {
      context.fillStyle = this.style.backgroundColor
      context.fillRect(0, 0, context.canvas.width, context.canvas.height)
    }
    paragraphs.forEach(paragraph => {
      paragraph.fragments.forEach(fragment => {
        const style = fragment.style
        if (style.backgroundColor) {
          context.fillStyle = style.backgroundColor
          context.fillRect(fragment.absoluteX, fragment.absoluteY, fragment.width, fragment.height)
        }
        this._setContextStyle(style)
        if (style.textStrokeWidth) {
          context.strokeText(fragment.data, fragment.fillX, fragment.fillY)
        }
        context.fillText(fragment.data, fragment.fillX, fragment.fillY)
        switch (style.textDecoration) {
          case 'underline':
            context.beginPath()
            context.moveTo(fragment.absoluteX, paragraph.absoluteY + paragraph.height - 2)
            context.lineTo(fragment.absoluteX + fragment.width, paragraph.absoluteY + paragraph.height - 2)
            context.stroke()
            break
          case 'line-through':
            context.beginPath()
            context.moveTo(fragment.absoluteX, paragraph.absoluteY + paragraph.height / 2)
            context.lineTo(fragment.absoluteX + fragment.width, paragraph.absoluteY + paragraph.height / 2)
            context.stroke()
            break
        }
      })
    })
  }

  protected _resizeView(width: number, height: number) {
    const view = this.view
    view.style.width = `${ width }px`
    view.style.height = `${ height }px`
    view.dataset.width = String(width)
    view.dataset.height = String(height)
    view.width = Math.max(1, Math.floor(width * this.pixelRatio))
    view.height = Math.max(1, Math.floor(height * this.pixelRatio))
  }

  protected _setContextStyle(style: TextFragmentStyle) {
    const context = this.context
    context.shadowColor = style.shadowColor
    context.shadowOffsetX = style.shadowOffsetX
    context.shadowOffsetY = style.shadowOffsetY
    context.shadowBlur = style.shadowBlur
    context.strokeStyle = style.textStrokeColor
    context.lineWidth = style.textStrokeWidth
    context.fillStyle = style.color
    context.direction = style.direction
    context.textAlign = style.textAlign
    context.textBaseline = style.textBaseline
    context.font = [
      style.fontStyle,
      style.fontWeight,
      `${ style.fontSize }px`,
      style.fontFamily,
    ].join(' ')
    context.fontKerning = style.fontKerning
    // TODO
    ;(context as any).letterSpacing = `${ style.letterSpacing }px`
  }

  update() {
    const context = this.context
    let { width, height } = this.style
    if (width === 'auto') width = 0
    if (height === 'auto') height = 0
    const result = this.measure(width, height)
    if (!width) width = result.width
    height = Math.max(height, result.height)
    this._resizeView(width, height)
    const pixelRatio = this.pixelRatio
    context.scale(pixelRatio, pixelRatio)
    context.clearRect(0, 0, context.canvas.width, context.canvas.height)
    this._draw(result.paragraphs)
  }
}
