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
    color: '#000',
    backgroundColor: 'rgba(0, 0, 0, 0)',
    fontSize: 14,
    fontWeight: 'normal',
    fontFamily: 'sans-serif',
    fontStyle: 'normal',
    fontKerning: 'normal',
    textWrap: 'wrap',
    textAlign: 'start',
    verticalAlign: 'baseline',
    textTransform: 'none',
    textDecoration: 'none',
    textStrokeWidth: 0,
    textStrokeColor: '#000',
    lineHeight: 1,
    letterSpacing: 0,
    shadowColor: 'rgba(0, 0, 0, 0)',
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    shadowBlur: 0,
    writingMode: 'horizontal-tb',
    textOrientation: 'mixed',
    ...style,
  }
}

export function measureText(options: MeasureTextOptions) {
  const { content, effects = [{}] } = options
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { width: userWidth, height: userHeight, ...style } = resolveStyle(options.style)
  let paragraphs = parseParagraphs(content, style)
  paragraphs = wrapParagraphs(paragraphs, userWidth, userHeight)

  let px = 0
  let py = 0
  paragraphs.forEach(p => {
    let highestF: Fragment | null = null

    p.fragments.forEach((f) => {
      f.update().measure()
      if (!highestF || highestF.contentBox.height < f.contentBox.height) highestF = f
    })

    const {
      typoHeight,
      typoAscent,
      lineHeight,
    } = canvasMeasureText('x', (highestF ?? p).computedStyle)
    p.xHeight = typoHeight
    p.baseline = (lineHeight - typoHeight) / 2 + typoAscent

    let fx = px
    let fy = py
    let maxHeight = 0
    p.fragments.forEach((f, fi) => {
      const style = f.computedStyle
      switch (style.writingMode) {
        case 'vertical-rl':
        case 'vertical-lr': {
          if (!fi) fy = 0
          f.inlineBox.translate(fx, fy)
          f.contentBox.translate(fx, fy)
          f.glyphBox.translate(fx, fy)
          let cy = fy
          f.characters.forEach((c, ci) => {
            const height = c.contentBox.y + c.contentBox.height
            c.contentBox.translate(fx, cy)
            c.glyphBox.translate(fx, cy)
            cy += height
            if (ci !== f.characters.length - 1) cy += style.letterSpacing
          })
          fy += f.inlineBox.height
          if (fi === p.fragments.length - 1) fx += f.inlineBox.width
          break
        }
        case 'horizontal-tb': {
          if (!fi) fx = 0
          f.inlineBox.translate(fx, fy)
          f.contentBox.translate(fx, fy)
          f.glyphBox.translate(fx, fy)
          fx += f.inlineBox.width
          maxHeight = Math.max(maxHeight, f.inlineBox.height)
          if (fi === p.fragments.length - 1) fy += maxHeight
          break
        }
      }
    })
    px = fx
    py = fy

    p.lineBox = BoundingBox.from(...p.fragments.map(f => f.inlineBox))
  })

  const box = BoundingBox.from(
    ...paragraphs.map(p => p.lineBox),
    new BoundingBox(0, 0, userWidth, userHeight),
  )
  const { width, height } = box

  // align
  paragraphs.forEach(p => {
    p.lineBox.width = Math.max(p.lineBox.width, width)
    p.contentBox = BoundingBox.from(...p.fragments.map(f => f.contentBox))
    p.glyphBox = BoundingBox.from(...p.fragments.map(f => f.glyphBox))
    p.fragments.forEach(f => {
      let fx = 0
      let fy = 0

      const fStyle = f.computedStyle
      switch (fStyle.writingMode) {
        case 'vertical-rl':
        case 'vertical-lr': {
          f.characters.forEach(c => {
            let cx = 0
            switch (fStyle.verticalAlign) {
              case 'top':
              case 'middle':
              case 'bottom':
              case 'sub':
              case 'super':
              case 'text-top':
              case 'text-bottom':
              case 'baseline':
              default:
                if (c.contentBox.width <= p.lineBox.width) {
                  cx = p.baseline - c.baseline
                }
                break
            }
            c.contentBox.translate(cx, 0)
            c.glyphBox.translate(cx, 0)
          })
          switch (fStyle.textAlign) {
            case 'end':
            case 'right':
              fy = height - p.contentBox.height
              break
            case 'center':
              fy = (height - p.contentBox.height) / 2
              break
          }
          f.characters.forEach(c => {
            c.contentBox.translate(0, fy)
            c.glyphBox.translate(0, fy)
          })
          break
        }
        case 'horizontal-tb': {
          switch (fStyle.textAlign) {
            case 'end':
            case 'right':
              fx = (width - p.contentBox.width)
              break
            case 'center':
              fx = (width - p.contentBox.width) / 2
              break
          }
          switch (fStyle.verticalAlign) {
            case 'top':
              fy = p.lineBox.y - f.inlineBox.y
              break
            case 'middle':
              fy = f.inlineBox.y - ((p.baseline - p.xHeight / 2) - f.inlineBox.height / 2)
              break
            case 'bottom':
              fy = p.lineBox.bottom - f.inlineBox.bottom
              break
            case 'sub':
              fy = (p.lineBox.y + p.baseline) - f.glyphBox.bottom
              break
            case 'super':
              fy = (p.lineBox.y + p.baseline) - f.glyphBox.y
              break
            case 'text-top':
              fy = p.glyphBox.y - f.inlineBox.y
              break
            case 'text-bottom':
              fy = p.glyphBox.bottom - f.inlineBox.bottom
              break
            case 'baseline':
            default:
              if (f.inlineBox.height < p.lineBox.height) {
                fy = p.baseline - f.baseline
              }
              break
          }
          break
        }
      }
      f.inlineBox.translate(fx, fy)
      f.contentBox.translate(fx, fy)
      f.glyphBox.translate(fx, fy)
    })
    p.contentBox = BoundingBox.from(...p.fragments.map(f => f.contentBox))
    p.glyphBox = BoundingBox.from(...p.fragments.map(f => f.glyphBox))
  })

  const contentBox = BoundingBox.from(...paragraphs.map(p => p.contentBox))
  const glyphBox = BoundingBox.from(...paragraphs.map(p => p.glyphBox))

  const viewBoxes: Array<BoundingBox> = []
  paragraphs.forEach(p => {
    p.fragments.forEach(f => {
      const fStyle = f.computedStyle
      effects.forEach(eStyle => {
        const style = { ...fStyle, ...eStyle }
        const { textStrokeWidth = 0, offsetX = 0, offsetY = 0 } = style
        if (textStrokeWidth || offsetX || offsetY) {
          const { x, y, width, height } = f.contentBox
          viewBoxes.push(new BoundingBox(
            Math.min(x, x + offsetX - textStrokeWidth / 2),
            Math.min(y, y + offsetY - textStrokeWidth / 2),
            Math.max(width, width + offsetX + textStrokeWidth),
            Math.max(height, height + offsetY + textStrokeWidth),
          ))
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
