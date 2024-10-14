import type { GlyphPathCommand, Sfnt } from 'modern-font'
import type { TextEffect, TextStyle } from '../types'
import type { Fragment } from './Fragment'
import { fonts, Ttf, Woff } from 'modern-font'
import { BoundingBox, Path2D } from 'modern-path2d'
import { drawPaths } from '../canvas'
import { getPointPosition, getSkewPoint } from '../utils'

const set1 = new Set(['\xA9', '\xAE', '\xF7'])
const set2 = new Set([
  '\u2014',
  '\u2026',
  '\u201C',
  '\u201D',
  '\uFE4F',
  '\uFE4B',
  '\uFE4C',
  '\u2018',
  '\u2019',
  '\u02DC',
])

export class Character {
  boundingBox = new BoundingBox()
  path = new Path2D()
  textWidth = 0
  textHeight = 0

  // glyph
  declare font: Sfnt
  declare glyphHeight: number
  declare glyphWidth: number
  declare underlinePosition: number
  declare underlineThickness: number
  declare yStrikeoutPosition: number
  declare yStrikeoutSize: number
  declare baseline: number
  declare centerDiviation: number
  declare glyphBox: BoundingBox
  declare centerPoint: { x: number, y: number }

  get computedStyle(): TextStyle {
    return this.parent.computedStyle
  }

  get isVertical(): boolean {
    return this.computedStyle.writingMode.includes('vertical')
  }

  get fontSize(): number {
    return this.computedStyle.fontSize
  }

  constructor(
    public content: string,
    public index: number,
    public parent: Fragment,
  ) {
    //
  }

  protected _updateFont(): this {
    const font = fonts.get(this.computedStyle.fontFamily)?.font
    if (font instanceof Woff || font instanceof Ttf) {
      this.font = font.sfnt
    }
    return this
  }

  protected _updateGlyph(font: Sfnt): this {
    const { content, computedStyle, boundingBox, isVertical } = this
    const { left, top, height } = boundingBox
    const { fontSize } = computedStyle
    const { unitsPerEm, ascender, descender, os2, post } = font
    const rate = unitsPerEm / fontSize
    const glyphWidth = font.getAdvanceWidth(content, fontSize)
    const glyphHeight = (ascender + Math.abs(descender)) / rate
    const baseline = ascender / rate
    const yStrikeoutPosition = (ascender - os2.yStrikeoutPosition) / rate
    const yStrikeoutSize = os2.yStrikeoutSize / rate
    const underlinePosition = (ascender - post.underlinePosition) / rate
    const underlineThickness = post.underlineThickness / rate
    this.glyphWidth = glyphWidth
    this.glyphHeight = glyphHeight
    this.underlinePosition = underlinePosition
    this.underlineThickness = underlineThickness
    this.yStrikeoutPosition = yStrikeoutPosition
    this.yStrikeoutSize = yStrikeoutSize
    this.baseline = baseline
    this.centerDiviation = 0.5 * height - baseline
    this.glyphBox = isVertical
      ? new BoundingBox(left, top, glyphHeight, glyphWidth)
      : new BoundingBox(left, top, glyphWidth, glyphHeight)
    this.centerPoint = this.glyphBox.getCenterPoint()
    return this
  }

  updatePath(): this {
    const font = this._updateFont().font

    if (!font) {
      return this
    }

    const {
      isVertical,
      content,
      textWidth,
      textHeight,
      boundingBox,
      computedStyle,
      baseline,
      glyphHeight,
      glyphWidth,
      yStrikeoutPosition,
      underlinePosition,
    } = this._updateGlyph(font)

    const { os2, ascender, descender } = font
    const usWinAscent = ascender
    const usWinDescent = descender
    const typoAscender = os2.sTypoAscender

    const { left, top, width, height } = boundingBox
    const { fontSize, fontStyle, textDecoration } = computedStyle

    let x = left
    let y = top + baseline
    let glyphIndex: number | undefined
    let commands: GlyphPathCommand[]

    if (isVertical) {
      x += (glyphHeight - glyphWidth) / 2
      if (Math.abs(textWidth - textHeight) > 0.1) {
        y -= ((usWinAscent - typoAscender) / (usWinAscent + Math.abs(usWinDescent))) * glyphHeight
      }
      // TODO
      glyphIndex = undefined
      // glyphIndex = font.substitutes[font.charToGlyphIndex(content)]
    }

    if (isVertical && !set1.has(content) && (content.codePointAt(0)! <= 256 || set2.has(content))) {
      commands = font.getPathCommands(content, x, top + baseline - (glyphHeight - glyphWidth) / 2, fontSize) ?? []
      const point = {
        y: top - (glyphHeight - glyphWidth) / 2 + glyphHeight / 2,
        x: x + glyphWidth / 2,
      }
      if (fontStyle === 'italic') {
        setItalic(
          commands,
          isVertical
            ? {
                x: point.x,
                y: top - (glyphHeight - glyphWidth) / 2 + baseline,
              }
            : null,
        )
      }
      set90Rotation(commands, point)
    }
    else {
      if (glyphIndex !== undefined) {
        commands = font.glyf.glyphs.get(glyphIndex).getPathCommands(x, y, fontSize)
        if (fontStyle === 'italic') {
          setItalic(
            commands,
            isVertical
              ? {
                  x: x + glyphWidth / 2,
                  y: top + (typoAscender / (usWinAscent + Math.abs(usWinDescent))) * glyphHeight,
                }
              : null,
          )
        }
      }
      else {
        commands = font.getPathCommands(content, x, y, fontSize) ?? []
        if (fontStyle === 'italic') {
          setItalic(
            commands,
            isVertical
              ? { x: x + glyphHeight / 2, y }
              : null,
          )
        }
      }
    }

    const lineWidth = 0.1 * fontSize
    if (isVertical) {
      const create = (start: number, len: number): GlyphPathCommand[] =>
        [
          { type: 'M', x: start, y: top },
          { type: 'L', x: start, y: top + height },
          { type: 'L', x: start + len, y: top + height },
          { type: 'L', x: start + len, y: top },
          { type: 'Z' },
        ] as GlyphPathCommand[]
      switch (textDecoration) {
        case 'underline':
          commands.push(...create(left, lineWidth))
          break
        case 'line-through':
          commands.push(...create(left + width / 2, lineWidth))
          break
      }
    }
    else {
      const create = (start: number, len: number): GlyphPathCommand[] =>
        [
          { type: 'M', x: left, y: start },
          { type: 'L', x: left + width, y: start },
          { type: 'L', x: left + width, y: start + len },
          { type: 'L', x: left, y: start + len },
          { type: 'Z' },
        ] as GlyphPathCommand[]
      switch (textDecoration) {
        case 'underline':
          commands.push(...create(top + underlinePosition, lineWidth))
          break
        case 'line-through':
          commands.push(...create(top + yStrikeoutPosition, lineWidth))
          break
      }
    }

    this.path = new Path2D(commands)

    return this

    function setItalic(commands: GlyphPathCommand[], startPoint?: any): void {
      // if (e.style === 'italic') return
      const _startPoint = startPoint || {
        y: top + baseline,
        x: left + glyphWidth / 2,
      }
      commands.forEach((command: any) => {
        ['', '1', '2'].forEach((arg) => {
          if (command[`x${arg}`]) {
            const pos = getSkewPoint(
              {
                x: command[`x${arg}`],
                y: command[`y${arg}`],
              },
              _startPoint,
              -0.24,
              0,
            )
            command[`x${arg}`] = pos.x
            command[`y${arg}`] = pos.y
          }
        })
      })
    }

    function set90Rotation(commands: GlyphPathCommand[], point: any): void {
      commands.forEach((command: any) => {
        ['', '1', '2'].forEach((arg) => {
          if (command[`x${arg}`]) {
            const pos = getPointPosition(
              {
                x: command[`x${arg}`],
                y: command[`y${arg}`],
              },
              point,
              90,
            )
            command[`x${arg}`] = pos.x
            command[`y${arg}`] = pos.y
          }
        })
      })
    }
  }

  update(): this {
    this.updatePath()
    return this
  }

  drawTo(ctx: CanvasRenderingContext2D, config: Partial<TextEffect> = {}): void {
    drawPaths({
      ctx,
      paths: [this.path],
      fontSize: this.computedStyle.fontSize,
      color: this.computedStyle.color,
      ...config,
    })
  }
}
