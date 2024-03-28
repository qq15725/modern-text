import { parseParagraphs } from './parse-paragraphs'
import { wrapParagraphs } from './wrap-paragraphs'
import { canvasMeasureText } from './canvas'
import { BoundingBox } from './bounding-box'
import type { TextContent, TextEffect, TextStyle } from './types'
import type { Fragment } from './fragment'

export interface MeasureTextStyle extends TextStyle {
  width: number
  height: number
}

export interface MeasureTextOptions {
  content: TextContent
  style?: Partial<MeasureTextStyle>
  effects?: Array<TextEffect>
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
  const { content, effects = [{}] } = options
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { width: userWidth, height: userHeight, ...style } = resolveStyle(options.style)
  let paragraphs = parseParagraphs(content, style)
  paragraphs = wrapParagraphs(paragraphs, userWidth, userHeight)

  let vWidth = paragraphs.reduce((w, p) => {
    return w + p.maxCharWidth * p.getComputedStyle().lineHeight
  }, 0)
  let px = 0
  let py = 0
  paragraphs.forEach(p => {
    const contentBoxes: Array<BoundingBox> = []
    let highestF: Fragment | null = null
    let fx = px
    let fy = py
    p.fragments.forEach((f, i) => {
      const fStyle = f.getComputedStyle()
      switch (fStyle.writingMode) {
        case 'vertical-rl':
        case 'vertical-lr': {
          const fWidth = p.maxCharWidth
          const fLineWidth = fWidth * fStyle.lineHeight
          if (!i) {
            fy = 0
            if (fStyle.writingMode === 'vertical-rl') {
              vWidth -= fLineWidth
              fx = vWidth
            }
          }
          const len = f.content.length
          const fHeight = len * fStyle.fontSize + (len - 1) * fStyle.letterSpacing
          f.contentBox.x = fx + (fLineWidth - fWidth) / 2
          f.contentBox.y = fy
          f.contentBox.width = fWidth
          f.contentBox.height = fHeight
          f.inlineBox.x = fx
          f.inlineBox.y = fy
          f.inlineBox.width = fLineWidth
          f.inlineBox.height = fHeight
          f.glyphBox.x = fx + (fLineWidth - fWidth) / 2
          f.glyphBox.y = fy
          f.glyphBox.width = fWidth
          f.glyphBox.height = fHeight
          f.baseline = 0
          f.centerX = fx + fLineWidth / 2
          fy += fHeight + fStyle.letterSpacing
          break
        }
        case 'horizontal-tb': {
          if (!i) fx = 0
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
          const fLineHeight = fHeight * fStyle.lineHeight
          const fFontHeight = fontBoundingBoxAscent + fontBoundingBoxDescent
          const fGlyphHeight = actualBoundingBoxAscent + actualBoundingBoxDescent
          const fGlyphWidth = actualBoundingBoxLeft + actualBoundingBoxRight
          const baseline = fy
            + (fLineHeight - fFontHeight) / 2
            + fontBoundingBoxAscent
          f.contentBox.x = fx
          f.contentBox.y = fy + (fLineHeight - fHeight) / 2
          f.contentBox.width = fWidth
          f.contentBox.height = fHeight
          f.inlineBox.x = fx
          f.inlineBox.y = fy
          f.inlineBox.width = fWidth
          f.inlineBox.height = fLineHeight
          f.glyphBox.x = fx
          f.glyphBox.y = baseline - actualBoundingBoxAscent
          f.glyphBox.width = fGlyphWidth
          f.glyphBox.height = fGlyphHeight
          f.baseline = baseline
          f.centerX = fx + actualBoundingBoxLeft
          contentBoxes.push(f.contentBox)
          p.contentBox = BoundingBox.from(...contentBoxes)
          if (p.contentBox.height < f.contentBox.height) highestF = f
          fx += fWidth
          break
        }
      }
    })
    p.lineBox = BoundingBox.from(...p.fragments.map(f => f.inlineBox))
    px += p.lineBox.width
    py += p.lineBox.height
    const xMetrics = canvasMeasureText('x', {
      ...(highestF ?? p).getComputedStyle(),
      textAlign: 'left',
      verticalAlign: 'baseline',
    })
    p.xHeight = xMetrics.actualBoundingBoxAscent
    p.baseline = p.lineBox.y
      + (p.lineBox.height - (xMetrics.fontBoundingBoxAscent + xMetrics.fontBoundingBoxDescent)) / 2
      + xMetrics.fontBoundingBoxAscent
  })

  const box = BoundingBox.from(
    ...paragraphs.map(p => p.lineBox),
    new BoundingBox({ width: userWidth, height: userHeight }),
  )
  const { width, height } = box

  // align
  paragraphs.forEach(p => {
    p.contentBox = BoundingBox.from(...p.fragments.map(f => f.contentBox))
    p.glyphBox = BoundingBox.from(...p.fragments.map(f => f.glyphBox))
    p.fragments.forEach(f => {
      const fStyle = f.getComputedStyle()
      const oldX = f.inlineBox.x
      const oldY = f.inlineBox.y
      let newX = oldX
      let newY = oldY

      switch (fStyle.writingMode) {
        case 'vertical-rl':
        case 'vertical-lr':
          switch (fStyle.textAlign) {
            case 'end':
            case 'right':
              newY += height - p.contentBox.height
              break
            case 'center':
              newY += (height - p.contentBox.height) / 2
              break
          }
          break
        case 'horizontal-tb': {
          switch (fStyle.textAlign) {
            case 'end':
            case 'right':
              newX += (width - p.contentBox.width)
              break
            case 'center':
              newX += (width - p.contentBox.width) / 2
              break
          }
          switch (fStyle.verticalAlign) {
            case 'top':
              newY += p.lineBox.y - f.inlineBox.y
              break
            case 'middle':
              newY = (p.baseline - p.xHeight / 2) - f.inlineBox.height / 2
              break
            case 'bottom':
              newY += p.lineBox.bottom - f.inlineBox.bottom
              break
            case 'sub':
              newY += p.baseline - f.glyphBox.bottom
              break
            case 'super':
              newY += p.baseline - f.glyphBox.y
              break
            case 'text-top':
              newY += p.glyphBox.y - f.inlineBox.y
              break
            case 'text-bottom':
              newY += p.glyphBox.bottom - f.inlineBox.bottom
              break
            case 'baseline':
            default:
              if (f.inlineBox.height < p.lineBox.height) {
                newY += p.baseline - f.baseline
              }
              break
          }
          break
        }
      }

      const diffX = newX - oldX
      const diffY = newY - oldY
      f.inlineBox.move(diffX, diffY)
      f.contentBox.move(diffX, diffY)
      f.glyphBox.move(diffX, diffY)
      f.baseline += diffY
      f.centerX += diffX
    })
    p.contentBox = BoundingBox.from(...p.fragments.map(f => f.contentBox))
    p.glyphBox = BoundingBox.from(...p.fragments.map(f => f.glyphBox))
  })

  const contentBox = BoundingBox.from(...paragraphs.map(p => p.contentBox))
  const glyphBox = BoundingBox.from(...paragraphs.map(p => p.glyphBox))

  const viewBoxes: Array<BoundingBox> = []
  paragraphs.forEach(p => {
    p.fragments.forEach(f => {
      const fStyle = f.getComputedStyle()
      effects.forEach(eStyle => {
        const style = { ...fStyle, ...eStyle }
        const { textStrokeWidth = 0, offsetX = 0, offsetY = 0 } = style
        if (textStrokeWidth || offsetX || offsetY) {
          const { x, y, width, height } = f.contentBox
          viewBoxes.push(new BoundingBox({
            x: Math.min(x, x + offsetX - textStrokeWidth / 2),
            y: Math.min(y, y + offsetY - textStrokeWidth / 2),
            width: Math.max(width, width + offsetX + textStrokeWidth),
            height: Math.max(height, height + offsetY + textStrokeWidth),
          }))
        }
      })
    })
  })

  return {
    box,
    contentBox,
    glyphBox,
    paragraphs,
    viewBox: BoundingBox.from(box, glyphBox, ...viewBoxes),
  }
}
