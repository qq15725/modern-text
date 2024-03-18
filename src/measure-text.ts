import { parseParagraphs } from './parse-paragraphs'
import { wrapParagraphs } from './wrap-paragraphs'
import { canvasMeasureText } from './canvas'
import { BoundingBox } from './bounding-box'
import type { TextContent, TextStyle } from './types'
import type { Fragment } from './fragment'

export interface MeasureTextStyle extends TextStyle {
  width: number
  height: number
}

export interface MeasureTextOptions {
  content: TextContent
  style?: Partial<MeasureTextStyle>
}

function resolveStyle(style?: Partial<MeasureTextStyle>): MeasureTextStyle {
  return {
    width: 0,
    height: 0,
    color: null,
    backgroundColor: null,
    fontSize: 14,
    fontWeight: 'normal',
    fontFamily: 'sans-serif',
    fontStyle: 'normal',
    fontKerning: 'normal',
    textWrap: 'wrap',
    textAlign: 'start',
    verticalAlign: 'baseline',
    textTransform: 'none',
    textDecoration: null,
    textStrokeWidth: 0,
    textStrokeColor: null,
    direction: 'inherit',
    lineHeight: 1,
    letterSpacing: 0,
    shadowColor: null,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    shadowBlur: 0,
    writingMode: 'horizontal-tb',
    ...style,
  }
}

export function measureText(options: MeasureTextOptions) {
  const { content } = options
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { width, height, ...style } = resolveStyle(options.style)
  let paragraphs = parseParagraphs(content, style)
  paragraphs = wrapParagraphs(paragraphs, width, height)

  let py = 0
  paragraphs.forEach(p => {
    const contentBoxes: Array<BoundingBox> = []
    let highestF: Fragment | null = null
    let fx = 0

    p.fragments.forEach(f => {
      const fStyle = f.getComputedStyle()
      const {
        fontBoundingBoxAscent,
        fontBoundingBoxDescent,
        actualBoundingBoxAscent,
        actualBoundingBoxDescent,
        actualBoundingBoxLeft,
        actualBoundingBoxRight,
        width: fWidth,
      } = canvasMeasureText(f.content, {
        ...fStyle,
        textAlign: 'center',
        verticalAlign: 'baseline',
      })
      const fHeight = fStyle.fontSize
      f.inlineBox.x = fx
      f.inlineBox.y = py
      f.inlineBox.width = fWidth
      f.inlineBox.height = fHeight * fStyle.lineHeight
      f.contentBox.x = f.inlineBox.x
      f.contentBox.y = f.inlineBox.y + (f.inlineBox.height - fHeight) / 2
      f.contentBox.width = fWidth
      f.contentBox.height = fHeight
      f.baseline = f.inlineBox.y
        + (f.inlineBox.height - (fontBoundingBoxAscent + fontBoundingBoxDescent)) / 2
        + fontBoundingBoxAscent
      f.glyphBox.x = f.contentBox.x
      f.glyphBox.y = f.baseline - actualBoundingBoxAscent
      f.glyphBox.width = actualBoundingBoxLeft + actualBoundingBoxRight
      f.glyphBox.height = actualBoundingBoxAscent + actualBoundingBoxDescent
      f.centerX = f.glyphBox.x + actualBoundingBoxLeft
      fx += f.contentBox.width
      contentBoxes.push(f.contentBox)
      p.contentBox = BoundingBox.from(...contentBoxes)
      if (p.contentBox.height < f.contentBox.height) highestF = f
    })

    const xMetrics = canvasMeasureText('x', {
      ...(highestF ?? p).getComputedStyle(),
      textAlign: 'left',
      verticalAlign: 'baseline',
    })
    const xFontHeight = xMetrics.fontBoundingBoxAscent + xMetrics.fontBoundingBoxDescent
    p.xHeight = xMetrics.actualBoundingBoxAscent

    p.lineBox = BoundingBox.from(...p.fragments.map(f => f.inlineBox))
    p.baseline = p.lineBox.y
      + (p.lineBox.height - xFontHeight) / 2
      + xMetrics.fontBoundingBoxAscent
    py += p.lineBox.height
  })

  // align
  paragraphs.forEach(p => {
    p.fragments.forEach(f => {
      const fStyle = f.getComputedStyle()
      const oldX = f.inlineBox.x
      const oldY = f.inlineBox.y

      let newX
      let newY = oldY
      switch (fStyle.textAlign) {
        case 'end':
        case 'right':
          newX = oldX + (p.lineBox.width - p.contentBox.width)
          break
        case 'center':
          newX = oldX + (p.lineBox.width - p.contentBox.width) / 2
          break
        case 'start':
        case 'left':
        default:
          newX = oldX + p.lineBox.x
          break
      }

      switch (fStyle.verticalAlign) {
        case 'top':
          newY = oldY + (p.lineBox.y - f.inlineBox.y)
          break
        case 'middle':
          newY = (p.baseline - p.xHeight / 2) - f.inlineBox.height / 2
          break
        case 'bottom':
          newY = oldY + (p.lineBox.bottom - f.inlineBox.bottom)
          break
        case 'sub':
          newY = oldY + (p.baseline - f.glyphBox.bottom)
          break
        case 'super':
          newY = oldY + (p.baseline - f.glyphBox.y)
          break
        case 'text-top':
          newY = oldY + (p.glyphBox.y - f.inlineBox.y)
          break
        case 'text-bottom':
          newY = oldY + (p.glyphBox.bottom - f.inlineBox.bottom)
          break
        case 'baseline':
        default:
          if (f.inlineBox.height < p.lineBox.height) {
            newY = oldY + (p.baseline - f.baseline)
          }
          break
      }

      const diffX = newX - oldX
      const diffY = newY - oldY
      f.inlineBox.move(diffX, diffY)
      f.contentBox.move(diffX, diffY)
      f.glyphBox.move(diffX, diffY)
      f.baseline += diffY
      f.centerX += diffX
    })
  })

  const verticalRlWidth = paragraphs.reduce((w, p) => w + p.maxCharWidth * p.getComputedStyle().lineHeight, 0)

  // vertical writing mode
  paragraphs.forEach(p => {
    p.fragments.forEach(f => {
      const fStyle = f.getComputedStyle()
      if (fStyle.writingMode === 'horizontal-tb') return
      const vw = p.maxCharWidth * fStyle.lineHeight
      const vh = f.content.length * fStyle.fontSize
        + (f.content.length - 1) * fStyle.letterSpacing
      switch (fStyle.writingMode) {
        case 'vertical-rl':
          f.contentBox.flipVerticalRl(vw, vh, verticalRlWidth)
          f.inlineBox.flipVerticalRl(vw, vh, verticalRlWidth)
          f.glyphBox.flipVerticalRl(vw, vh, verticalRlWidth)
          break
        case 'vertical-lr':
          f.contentBox.flipVerticalLr(vw, vh)
          f.inlineBox.flipVerticalLr(vw, vh)
          f.glyphBox.flipVerticalLr(vw, vh)
          break
      }
    })
    p.contentBox = BoundingBox.from(...p.fragments.map(f => f.contentBox))
    p.lineBox = BoundingBox.from(...p.fragments.map(f => f.inlineBox))
    p.glyphBox = BoundingBox.from(...p.fragments.map(f => f.glyphBox))
  })

  return {
    actualContentBox: BoundingBox.from(...paragraphs.map(p => p.contentBox)),
    contentBox: BoundingBox.from(...paragraphs.map(p => p.lineBox)),
    glyphBox: BoundingBox.from(...paragraphs.map(p => p.glyphBox)),
    paragraphs,
  }
}
