import { parseParagraphs } from './parse-paragraphs'
import { wrapParagraphs } from './wrap-paragraphs'
import { canvasMeasureText } from './canvas-measure-text'
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

export const defaultTextStyles: MeasureTextStyle = {
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
}

function resolveStyle(style?: Partial<MeasureTextStyle>): MeasureTextStyle {
  return {
    ...defaultTextStyles,
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
      glyphHeight,
      baseline,
    } = canvasMeasureText('x', (highestF ?? p).computedStyle)
    p.xHeight = glyphHeight
    p.baseline = baseline

    const pStyle = p.computedStyle

    let fx = px
    let fy = py
    let maxHeight = 0
    p.fragments.forEach((f, fi) => {
      const fStyle = f.computedStyle
      switch (pStyle.writingMode) {
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
            if (ci !== f.characters.length - 1) cy += fStyle.letterSpacing
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
          let cx = fx
          f.characters.forEach((c, ci) => {
            const width = c.contentBox.x + c.contentBox.width
            c.contentBox.translate(cx, fy)
            c.glyphBox.translate(cx, fy)
            cx += width
            if (ci !== f.characters.length - 1) cx += fStyle.letterSpacing
          })
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
    let pDx = 0
    const pDy = 0
    const pStyle = p.computedStyle
    switch (pStyle.writingMode) {
      case 'vertical-rl':
        pDx += width - (p.lineBox.x * 2 + p.lineBox.width)
      // eslint-disable-next-line no-fallthrough
      case 'vertical-lr':
        p.lineBox.height = Math.max(p.lineBox.height, height)
        break
      case 'horizontal-tb':
        p.lineBox.width = Math.max(p.lineBox.width, width)
        break
    }
    p.contentBox = BoundingBox.from(...p.fragments.map(f => f.contentBox))
    p.glyphBox = BoundingBox.from(...p.fragments.map(f => f.glyphBox))
    p.fragments.forEach(f => {
      let fDx = pDx
      let fDy = pDy
      const fStyle = f.computedStyle
      switch (pStyle.writingMode) {
        case 'vertical-rl':
        case 'vertical-lr': {
          switch (fStyle.textAlign) {
            case 'end':
            case 'right':
              fDy += height - p.contentBox.height
              break
            case 'center':
              fDy += (height - p.contentBox.height) / 2
              break
          }
          f.characters.forEach(c => {
            let cDx = fDx
            const cDy = fDy
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
                cDx += p.baseline - c.baseline
                break
            }
            c.contentBox.translate(cDx, cDy)
            c.glyphBox.translate(cDx, cDy)
          })
          break
        }
        case 'horizontal-tb': {
          switch (fStyle.textAlign) {
            case 'end':
            case 'right':
              fDx = (width - p.contentBox.width)
              break
            case 'center':
              fDx = (width - p.contentBox.width) / 2
              break
          }
          switch (fStyle.verticalAlign) {
            case 'top':
              fDy = p.lineBox.y - f.inlineBox.y
              break
            case 'middle':
              fDy = f.inlineBox.y - ((p.baseline - p.xHeight / 2) - f.inlineBox.height / 2)
              break
            case 'bottom':
              fDy = p.lineBox.bottom - f.inlineBox.bottom
              break
            case 'sub':
              fDy = (p.lineBox.y + p.baseline) - f.glyphBox.bottom
              break
            case 'super':
              fDy = (p.lineBox.y + p.baseline) - f.glyphBox.y
              break
            case 'text-top':
              fDy = p.glyphBox.y - f.inlineBox.y
              break
            case 'text-bottom':
              fDy = p.glyphBox.bottom - f.inlineBox.bottom
              break
            case 'baseline':
            default:
              if (f.inlineBox.height < p.lineBox.height) {
                fDy = p.baseline - f.baseline
              }
              break
          }
          break
        }
      }
      f.characters.forEach(c => {
        c.contentBox.translate(fDx, fDy)
        c.glyphBox.translate(fDx, fDy)
      })
      f.inlineBox.translate(fDx, fDy)
      f.contentBox.translate(fDx, fDy)
      f.glyphBox.translate(fDx, fDy)
    })
    p.lineBox = BoundingBox.from(p.lineBox, ...p.fragments.map(f => f.inlineBox))
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
