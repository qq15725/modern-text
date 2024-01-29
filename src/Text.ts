export type FontWeight = 'normal' | 'bold' | 'lighter' | 'bolder' | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900
export type FontStyle = 'normal' | 'italic' | 'oblique' | `oblique ${ string }`
export type FontKerning = 'auto' | 'none' | 'normal'
export type TextWrap = 'wrap' | 'nowrap'
export type TextAlign = 'center' | 'end' | 'left' | 'right' | 'start'
export type VerticalAlign = 'baseline' | 'top' | 'middle' | 'bottom' | 'sub' | 'super' | 'text-top' | 'text-bottom'
export type TextDecoration = 'underline' | 'line-through'

export interface BoundingBox {
  left: number
  right: number
  top: number
  bottom: number
  width: number
  height: number
}

export interface TextParagraph {
  contentBox: BoundingBox
  lineBox: BoundingBox
  glyphBox: BoundingBox
  baseline: number
  xHeight: number
  fragments: Array<TextFragment>
  style: TextFragmentStyle
}

export interface TextFragment {
  contentBox: BoundingBox
  inlineBox: BoundingBox
  glyphBox: BoundingBox
  centerX: number
  baseline: number
  content: string
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
  verticalAlign: VerticalAlign
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

export interface TextParagraphWithContentAndStyle extends Partial<TextFragmentStyle> {
  content: string
}

export interface TextParagraphWithFragmentsAndStyle extends Partial<TextFragmentStyle> {
  fragments: Array<TextFragmentWithStyle>
}

export interface TextFragmentWithStyle extends Partial<TextFragmentStyle> {
  content: string
}

export type TextContent =
  | string
  | TextParagraphWithContentAndStyle | TextParagraphWithFragmentsAndStyle
  | Array<TextParagraphWithContentAndStyle | TextParagraphWithFragmentsAndStyle>

export interface TextOptions {
  view?: HTMLCanvasElement
  pixelRatio?: number
  content?: TextContent
  style?: Partial<TextStyle>
}

export interface Metrics {
  contentBox: BoundingBox
  glyphBox: BoundingBox
  actualContentBox: BoundingBox
  paragraphs: Array<TextParagraph>
}

export class Text {
  // eslint-disable-next-line no-misleading-character-class
  static punctuationRegex = /[\s\n\t\u200B\u200C\u200D\u200E\u200F.,?!:;"'(){}\[\]<>\/\\|~#\$%\*\+=&^，。？！：；“”‘’（）【】《》……——]/

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
      verticalAlign: 'baseline',
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
  content: TextContent

  constructor(options: TextOptions = {}) {
    const {
      view = document.createElement('canvas'),
      pixelRatio = window.devicePixelRatio || 1,
      content = '',
      style,
    } = options

    this.view = view
    this.context = view.getContext('2d')!
    this.pixelRatio = pixelRatio
    this.content = content
    this.style = {
      ...Text.defaultStyle,
      ...style,
    }
    this.update()
  }

  protected _createBox(left = 0, top = 0, width = 0, height = 0): BoundingBox {
    return {
      left,
      top,
      width,
      height,
      right: left + width,
      bottom: top + height,
    }
  }

  protected _moveBox(box: BoundingBox, tx = 0, ty = 0): void {
    box.left += tx
    box.right += tx
    box.top += ty
    box.bottom += ty
  }

  protected _updateBoxSize(box: BoundingBox): void {
    box.width = box.right - box.left
    box.height = box.bottom - box.top
  }

  protected _mergeBoxes(boxes: Array<BoundingBox>): BoundingBox {
    const merged = boxes.slice(1).reduce((merged, box) => {
      merged.left = Math.min(merged.left, box.left)
      merged.top = Math.min(merged.top, box.top)
      merged.right = Math.max(merged.right, box.right)
      merged.bottom = Math.max(merged.bottom, box.bottom)
      return merged
    }, { ...boxes[0] })
    this._updateBoxSize(merged)
    return merged
  }

  measure(): Metrics {
    let { width } = this.style
    if (width === 'auto') width = 0
    let paragraphs = this._createParagraphs(this.content)
    paragraphs = this._createWrapedParagraphs(paragraphs, width)
    const context = this.context
    let paragraphY = 0
    for (let len = paragraphs.length, i = 0; i < len; i++) {
      const paragraph = paragraphs[i]
      const contentBoxes: Array<BoundingBox> = []
      let fragmentX = 0
      let highestFragment: TextFragment | null = null
      for (const fragment of paragraph.fragments) {
        this._setContextStyle({
          ...fragment.style,
          textAlign: 'center',
          verticalAlign: 'baseline',
        })
        const textMetrics = context.measureText(fragment.content)
        const contentWidth = textMetrics.width
        const contentHeight = fragment.style.fontSize
        fragment.inlineBox = this._createBox(
          fragmentX,
          paragraphY,
          contentWidth,
          contentHeight * fragment.style.lineHeight,
        )
        fragment.contentBox = this._createBox(
          fragment.inlineBox.left,
          fragment.inlineBox.top + (fragment.inlineBox.height - contentHeight) / 2,
          contentWidth,
          contentHeight,
        )
        const fontHeight = textMetrics.fontBoundingBoxAscent + textMetrics.fontBoundingBoxDescent
        const glyphWidth = textMetrics.actualBoundingBoxLeft + textMetrics.actualBoundingBoxRight
        const glyphHeight = textMetrics.actualBoundingBoxAscent + textMetrics.actualBoundingBoxDescent
        fragment.baseline = fragment.inlineBox.top
          + (fragment.inlineBox.height - fontHeight) / 2
          + textMetrics.fontBoundingBoxAscent
        fragment.glyphBox = this._createBox(
          fragment.contentBox.left + (fragment.contentBox.width - glyphWidth) / 2,
          fragment.baseline - textMetrics.actualBoundingBoxAscent,
          glyphWidth,
          glyphHeight,
        )
        fragment.centerX = fragment.glyphBox.left + textMetrics.actualBoundingBoxLeft
        fragmentX += fragment.contentBox.width
        contentBoxes.push(fragment.contentBox)
        paragraph.contentBox = this._mergeBoxes(contentBoxes)
        if (paragraph.contentBox.height < fragment.contentBox.height) highestFragment = fragment
      }
      paragraph.lineBox = this._mergeBoxes([
        ...paragraph.fragments.map(fragment => fragment.inlineBox),
        this._createBox(0, paragraphY, width),
      ])
      this._setContextStyle({
        ...(highestFragment ?? paragraph).style,
        textAlign: 'left',
        verticalAlign: 'baseline',
      })
      const xTextMetrics = context.measureText('x')
      const xFontHeight = xTextMetrics.fontBoundingBoxAscent + xTextMetrics.fontBoundingBoxDescent
      paragraph.xHeight = xTextMetrics.actualBoundingBoxAscent
      paragraph.baseline = paragraph.lineBox.top
        + (paragraph.lineBox.height - xFontHeight) / 2
        + xTextMetrics.fontBoundingBoxAscent
      paragraphY += paragraph.lineBox.height
    }

    for (let len = paragraphs.length, i = 0; i < len; i++) {
      const paragraph = paragraphs[i]

      paragraph.fragments.forEach(fragment => {
        const oldLeft = fragment.inlineBox.left
        const oldTop = fragment.inlineBox.top

        let newLeft
        let newTop = oldTop
        switch (fragment.style.textAlign) {
          case 'end':
          case 'right':
            newLeft = oldLeft + (paragraph.lineBox.width - paragraph.contentBox.width)
            break
          case 'center':
            newLeft = oldLeft + (paragraph.lineBox.width - paragraph.contentBox.width) / 2
            break
          case 'start':
          case 'left':
          default:
            newLeft = oldLeft + paragraph.lineBox.left
            break
        }

        switch (fragment.style.verticalAlign) {
          case 'top':
            newTop = oldTop + (paragraph.lineBox.top - fragment.inlineBox.top)
            break
          case 'middle':
            newTop = (paragraph.baseline - paragraph.xHeight / 2) - fragment.inlineBox.height / 2
            break
          case 'bottom':
            newTop = oldTop + (paragraph.lineBox.bottom - fragment.inlineBox.bottom)
            break
          case 'sub':
            newTop = oldTop + (paragraph.baseline - fragment.glyphBox.bottom)
            break
          case 'super':
            newTop = oldTop + (paragraph.baseline - fragment.glyphBox.top)
            break
          case 'text-top':
            newTop = oldTop + (paragraph.glyphBox.top - fragment.inlineBox.top)
            break
          case 'text-bottom':
            newTop = oldTop + (paragraph.glyphBox.bottom - fragment.inlineBox.bottom)
            break
          case 'baseline':
          default:
            if (fragment.inlineBox.height < paragraph.lineBox.height) {
              newTop = oldTop + (paragraph.baseline - fragment.baseline)
            }
            break
        }

        const diffLeft = newLeft - oldLeft
        const diffTop = newTop - oldTop
        this._moveBox(fragment.inlineBox, diffLeft, diffTop)
        this._moveBox(fragment.contentBox, diffLeft, diffTop)
        this._moveBox(fragment.glyphBox, diffLeft, diffTop)
        fragment.baseline += diffTop
        fragment.centerX += diffLeft
      })

      paragraph.contentBox = this._mergeBoxes(paragraph.fragments.map(fragment => fragment.contentBox))
      paragraph.glyphBox = this._mergeBoxes(paragraph.fragments.map(fragment => fragment.glyphBox))
    }

    return {
      actualContentBox: this._mergeBoxes(paragraphs.map(paragraph => paragraph.contentBox)),
      contentBox: this._mergeBoxes(paragraphs.map(paragraph => paragraph.lineBox)),
      glyphBox: this._mergeBoxes(paragraphs.map(paragraph => paragraph.glyphBox)),
      paragraphs,
    }
  }

  protected _createParagraphs(content: TextContent): Array<TextParagraph> {
    const createTextParagraph = (props: Record<string, any> = {}): TextParagraph => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { width: _width, height: _height, ...style } = this.style
      return {
        contentBox: this._createBox(),
        lineBox: this._createBox(),
        glyphBox: this._createBox(),
        baseline: 0,
        fragments: [],
        ...props,
        style: {
          ...style,
          ...props.style,
        },
      } as any
    }

    const createTextFragments = (props: Record<string, any> = {}): Array<TextFragment> => {
      const fragments: Array<TextFragment> = []
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { width: _width, height: _height, ...style } = this.style
      fragments.push({
        contentBox: this._createBox(),
        inlineBox: this._createBox(),
        glyphBox: this._createBox(),
        centerX: 0,
        baseline: 0,
        ...props,
        style: {
          ...style,
          ...props.style,
        },
        content: props.content ?? '',
      } as any)
      return fragments
    }

    const paragraphs: Array<TextParagraph> = []
    if (typeof content === 'string') {
      paragraphs.push(createTextParagraph({ fragments: createTextFragments({ content }) }))
    } else {
      content = Array.isArray(content) ? content : [content]
      for (const p of content) {
        if ('fragments' in p) {
          const { fragments, ...pStyle } = p
          const paragraph = createTextParagraph({ style: pStyle })
          for (const f of fragments) {
            const { content: fData, ...fStyle } = f
            paragraph.fragments.push(...createTextFragments({ content: fData, style: { ...pStyle, ...fStyle } }))
          }
          paragraphs.push(paragraph)
        } else if ('content' in p) {
          const { content: pData, ...pStyle } = p
          const paragraph = createTextParagraph({ style: pStyle })
          paragraph.fragments.push(...createTextFragments({ content: pData, style: pStyle }))
          paragraphs.push(paragraph)
        }
      }
    }
    return paragraphs
  }

  protected _createWrapedParagraphs(
    paragraphs: Array<TextParagraph>,
    width: number,
  ): Array<TextParagraph> {
    const deepClone = (val: Record<string, any>) => JSON.parse(JSON.stringify(val))

    const wrapedParagraphs: Array<TextParagraph> = []
    const restParagraphs = paragraphs.slice()
    let paragraph: TextParagraph | undefined
    let fragment: TextFragment | undefined
    // eslint-disable-next-line no-cond-assign
    while (paragraph = restParagraphs.shift()) {
      const restFragments = paragraph.fragments.slice()
      let paragraphWidth = 0
      const fragments = []
      // eslint-disable-next-line no-cond-assign
      while (fragment = restFragments.shift()) {
        const style = fragment.style
        this._setContextStyle(style)
        let content = ''
        let wrap = false
        for (const char of fragment.content) {
          const charWidth = this.context!.measureText(char).width
          const isNewline = /^[\r\n]$/.test(char)
          if (
            isNewline
            || (
              style.textWrap === 'wrap'
              && width
              && paragraphWidth + charWidth > width
            )
          ) {
            let pos = isNewline ? content.length + 1 : content.length
            if (!paragraphWidth && !pos) {
              content += char
              pos++
            }
            if (content.length) fragments.push({ ...deepClone(fragment), content })
            if (fragments.length) {
              wrapedParagraphs.push({
                ...deepClone(paragraph),
                fragments: fragments.slice(),
              })
              fragments.length = 0
            }
            const restText = fragment.content.substring(pos)
            if (restText.length || restFragments.length) {
              restParagraphs.unshift({
                ...deepClone(paragraph),
                fragments: (
                  restText.length
                    ? [{ ...deepClone(fragment), content: restText }]
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
          content += char
        }
        if (!wrap) fragments.push(deepClone(fragment))
      }
      if (fragments.length) {
        wrapedParagraphs.push({ ...deepClone(paragraph), fragments })
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
      if (paragraph.style.backgroundColor) {
        context.fillStyle = paragraph.style.backgroundColor
        context.fillRect(paragraph.lineBox.left, paragraph.lineBox.top, paragraph.lineBox.width, paragraph.lineBox.height)
      }
    })
    paragraphs.forEach(paragraph => {
      paragraph.fragments.forEach(fragment => {
        if (fragment.style.backgroundColor) {
          context.fillStyle = fragment.style.backgroundColor
          context.fillRect(fragment.inlineBox.left, fragment.inlineBox.top, fragment.inlineBox.width, fragment.inlineBox.height)
        }
        this._setContextStyle({
          ...fragment.style,
          textAlign: 'left',
          verticalAlign: 'top',
        })
        if (fragment.style.textStrokeWidth) {
          context.strokeText(fragment.content, fragment.contentBox.left, fragment.contentBox.top)
        }
        context.fillText(fragment.content, fragment.contentBox.left, fragment.contentBox.top)
        switch (fragment.style.textDecoration) {
          case 'underline':
            context.beginPath()
            context.moveTo(fragment.contentBox.left, fragment.contentBox.top + fragment.contentBox.height - 2)
            context.lineTo(fragment.contentBox.left + fragment.contentBox.width, fragment.contentBox.top + fragment.contentBox.height - 2)
            context.stroke()
            break
          case 'line-through':
            context.beginPath()
            context.moveTo(fragment.contentBox.left, fragment.contentBox.top + fragment.contentBox.height / 2)
            context.lineTo(fragment.contentBox.left + fragment.contentBox.width, fragment.contentBox.top + fragment.contentBox.height / 2)
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
    switch (style.verticalAlign) {
      case 'baseline':
        context.textBaseline = 'alphabetic'
        break
      case 'top':
      case 'middle':
      case 'bottom':
        context.textBaseline = style.verticalAlign
        break
    }
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
    const { contentBox, paragraphs } = this.measure()
    if (!width) width = contentBox.width
    height = Math.max(height, contentBox.height)
    this._resizeView(width, height)
    const pixelRatio = this.pixelRatio
    context.scale(pixelRatio, pixelRatio)
    context.clearRect(0, 0, context.canvas.width, context.canvas.height)
    this._draw(paragraphs)
  }
}
