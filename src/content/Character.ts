import type { GlyphPathCommand, Sfnt } from 'modern-font'
import type { Vector2, VectorLike } from 'modern-path2d'
import type { TextEffect, TextStyle } from '../types'
import type { Fragment } from './Fragment'
import { fonts, Ttf, Woff } from 'modern-font'
import { BoundingBox, Path2D } from 'modern-path2d'
import { drawPath } from '../canvas'
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
  textWidth = 0
  textHeight = 0
  path = new Path2D()

  // glyph
  declare glyphHeight: number
  declare glyphWidth: number
  declare underlinePosition: number
  declare underlineThickness: number
  declare yStrikeoutPosition: number
  declare yStrikeoutSize: number
  declare baseline: number
  declare centerDiviation: number
  declare glyphBox: BoundingBox
  declare center: VectorLike

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

  protected _font(): Sfnt | undefined {
    const font = fonts.get(this.computedStyle.fontFamily)?.font
    if (font instanceof Woff || font instanceof Ttf) {
      return font.sfnt
    }
    return undefined
  }

  updateGlyph(font = this._font()): this {
    if (!font) {
      return this
    }
    const { unitsPerEm, ascender, descender, os2, post } = font
    const { content, computedStyle, boundingBox } = this
    const { height } = boundingBox
    const { fontSize } = computedStyle
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
    return this
  }

  updatePath(): this {
    const font = this._font()

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
    } = this.updateGlyph(font)

    const { os2, ascender, descender } = font
    const usWinAscent = ascender
    const usWinDescent = descender
    const typoAscender = os2.sTypoAscender

    const { left, top } = boundingBox
    const { fontSize, fontStyle } = computedStyle

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
        commands = this._italic(
          commands,
          isVertical
            ? {
                x: point.x,
                y: top - (glyphHeight - glyphWidth) / 2 + baseline,
              }
            : undefined,
        )
      }
      commands = this._rotation90(commands, point)
    }
    else {
      if (glyphIndex !== undefined) {
        commands = font.glyphs.get(glyphIndex).getPathCommands(x, y, fontSize)
        if (fontStyle === 'italic') {
          commands = this._italic(
            commands,
            isVertical
              ? {
                  x: x + glyphWidth / 2,
                  y: top + (typoAscender / (usWinAscent + Math.abs(usWinDescent))) * glyphHeight,
                }
              : undefined,
          )
        }
      }
      else {
        commands = font.getPathCommands(content, x, y, fontSize) ?? []
        if (fontStyle === 'italic') {
          commands = this._italic(
            commands,
            isVertical
              ? { x: x + glyphHeight / 2, y }
              : undefined,
          )
        }
      }
    }

    commands.push(...this._decoration())

    const path = new Path2D(commands)
    path.style = {
      fill: computedStyle.color,
      stroke: computedStyle.textStrokeWidth
        ? computedStyle.textStrokeColor
        : 'none',
      strokeWidth: computedStyle.textStrokeWidth
        ? computedStyle.textStrokeWidth * fontSize * 0.03
        : 0,
    }
    this.path = path
    this.glyphBox = this.getGlyphBoundingBox()
    this.center = this.glyphBox.getCenterPoint()

    return this
  }

  update(): this {
    this
      .updatePath()
    return this
  }

  protected _decoration(): GlyphPathCommand[] {
    const { isVertical, underlinePosition, yStrikeoutPosition } = this
    const { textDecoration, fontSize } = this.computedStyle
    const { left, top, width, height } = this.boundingBox
    const lineWidth = 0.1 * fontSize

    let start: number
    switch (textDecoration) {
      case 'underline':
        if (isVertical) {
          start = left
        }
        else {
          start = top + underlinePosition
        }
        break
      case 'line-through':
        if (isVertical) {
          start = left + width / 2
        }
        else {
          start = top + yStrikeoutPosition
        }
        break
      case 'none':
      default:
        return []
    }

    if (isVertical) {
      return [
        { type: 'M', x: start, y: top },
        { type: 'L', x: start, y: top + height },
        { type: 'L', x: start + lineWidth, y: top + height },
        { type: 'L', x: start + lineWidth, y: top },
        { type: 'Z' },
      ]
    }
    else {
      return [
        { type: 'M', x: left, y: start },
        { type: 'L', x: left + width, y: start },
        { type: 'L', x: left + width, y: start + lineWidth },
        { type: 'L', x: left, y: start + lineWidth },
        { type: 'Z' },
      ]
    }
  }

  protected _italic(commands: GlyphPathCommand[], startPoint?: VectorLike): GlyphPathCommand[] {
    // if (e.style === 'italic') return
    const { baseline, glyphWidth } = this
    const { left, top } = this.boundingBox
    const _startPoint = startPoint || {
      y: top + baseline,
      x: left + glyphWidth / 2,
    }
    return this._transform(commands, (x, y) => {
      const p = getSkewPoint({ x, y }, _startPoint, -0.24, 0)
      return [p.x, p.y]
    })
  }

  protected _rotation90(commands: GlyphPathCommand[], point: VectorLike): GlyphPathCommand[] {
    return this._transform(commands, (x, y) => {
      const p = getPointPosition({ x, y }, point, 90)
      return [p.x, p.y]
    })
  }

  protected _transform(commands: GlyphPathCommand[], cb: (x: number, y: number) => number[]): GlyphPathCommand[] {
    return commands.map((rawCmd) => {
      const cmd = { ...rawCmd }
      switch (cmd.type) {
        case 'L':
        case 'M':
          [cmd.x, cmd.y] = cb(cmd.x, cmd.y)
          break
        case 'Q':
          [cmd.x1, cmd.y1] = cb(cmd.x1, cmd.y1)
          ;[cmd.x, cmd.y] = cb(cmd.x, cmd.y)
          break
        case 'C':
          [cmd.x1, cmd.y1] = cb(cmd.x1, cmd.y1)
          ;[cmd.x2, cmd.y2] = cb(cmd.x2, cmd.y2)
          ;[cmd.x, cmd.y] = cb(cmd.x, cmd.y)
          break
      }
      return cmd
    })
  }

  getGlyphMinMax(min?: Vector2, max?: Vector2): { min: Vector2, max: Vector2 } {
    return this.path.getMinMax(min, max)
  }

  getGlyphBoundingBox(withStyle?: boolean): BoundingBox {
    return this.path.getBoundingBox(withStyle)
  }

  drawTo(ctx: CanvasRenderingContext2D, config: Partial<TextEffect> = {}): void {
    drawPath({
      ctx,
      path: this.path,
      fontSize: this.computedStyle.fontSize,
      color: this.computedStyle.color,
      ...config,
    })
  }
}
