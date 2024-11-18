import type { Fonts, Sfnt } from 'modern-font'
import type { Vector2, VectorLike } from 'modern-path2d'
import type { FontWeight, TextStyle } from '../types'
import type { Fragment } from './Fragment'
import { fonts as globalFonts } from 'modern-font'
import { BoundingBox, Path2D } from 'modern-path2d'
import { drawPath } from '../canvas'

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

const fsSelectionMap: Record<number, 'italic' | 'bold'> = {
  0x01: 'italic',
  0x20: 'bold',
}

const macStyleMap: Record<number, 'italic' | 'bold'> = {
  0x01: 'italic',
  0x02: 'bold',
}

const fontWeightMap: Record<FontWeight, number> = {
  100: -0.2,
  200: -0.1,
  300: 0,
  400: 0,
  normal: 0,
  500: 0.1,
  600: 0.2,
  700: 0.3,
  bold: 0.3,
  800: 0.4,
  900: 0.5,
}

export class Character {
  path = new Path2D()
  lineBox = new BoundingBox()
  inlineBox = new BoundingBox()
  glyphBox: BoundingBox | undefined
  underlinePosition = 0
  underlineThickness = 0
  strikeoutPosition = 0
  strikeoutSize = 0
  ascender = 0
  descender = 0
  typoAscender = 0
  typoDescender = 0
  typoLineGap = 0
  winAscent = 0
  winDescent = 0
  xHeight = 0
  capHeight = 0
  baseline = 0
  centerDiviation = 0
  fontStyle?: 'bold' | 'italic'

  get center(): Vector2 | undefined {
    return this.glyphBox?.center
  }

  get computedStyle(): TextStyle {
    return this.parent.computedStyle
  }

  get isVertical(): boolean {
    return this.computedStyle.writingMode.includes('vertical')
  }

  get fontSize(): number {
    return this.computedStyle.fontSize
  }

  get fontHeight(): number {
    return this.fontSize * this.computedStyle.lineHeight
  }

  constructor(
    public content: string,
    public index: number,
    public parent: Fragment,
  ) {
    //
  }

  protected _getFontSfnt(fonts?: Fonts): Sfnt | undefined {
    const fontFamily = this.computedStyle.fontFamily
    const _fonts = (fonts ?? globalFonts)
    const font = fontFamily
      ? _fonts.get(fontFamily)
      : _fonts.fallbackFont
    return font?.getSfnt()
  }

  updateGlyph(sfnt = this._getFontSfnt()): this {
    if (!sfnt) {
      return this
    }
    const { hhea, os2, post, head } = sfnt
    const unitsPerEm = head.unitsPerEm
    const ascender = hhea.ascent
    const descender = hhea.descent
    const { content, computedStyle } = this
    const { fontSize } = computedStyle
    const rate = unitsPerEm / fontSize
    const advanceWidth = sfnt.getAdvanceWidth(content, fontSize)
    const advanceHeight = (ascender + Math.abs(descender)) / rate
    const baseline = ascender / rate
    this.inlineBox.width = advanceWidth
    this.inlineBox.height = advanceHeight
    this.underlinePosition = (ascender - post.underlinePosition) / rate
    this.underlineThickness = post.underlineThickness / rate
    this.strikeoutPosition = (ascender - os2.yStrikeoutPosition) / rate
    this.strikeoutSize = os2.yStrikeoutSize / rate
    this.ascender = ascender / rate
    this.descender = descender / rate
    this.typoAscender = os2.sTypoAscender / rate
    this.typoDescender = os2.sTypoDescender / rate
    this.typoLineGap = os2.sTypoLineGap / rate
    this.winAscent = os2.usWinAscent / rate
    this.winDescent = os2.usWinDescent / rate
    this.xHeight = os2.sxHeight / rate
    this.capHeight = os2.sCapHeight / rate
    this.baseline = baseline
    this.centerDiviation = advanceHeight / 2 - baseline
    this.fontStyle = fsSelectionMap[os2.fsSelection] ?? macStyleMap[head.macStyle]
    return this
  }

  update(fonts?: Fonts): this {
    const sfnt = this._getFontSfnt(fonts)

    if (!sfnt) {
      return this
    }

    this.updateGlyph(sfnt)

    const {
      isVertical,
      content,
      computedStyle: style,
      baseline,
      inlineBox,
      ascender,
      descender,
      typoAscender,
      fontStyle,
    } = this

    const { left, top } = inlineBox
    const needsItalic = style.fontStyle === 'italic' && fontStyle !== 'italic'

    let x = left
    let y = top + baseline
    let glyphIndex: number | undefined
    const path = new Path2D()

    if (isVertical) {
      x += (inlineBox.height - inlineBox.width) / 2
      if (Math.abs(inlineBox.width - inlineBox.height) > 0.1) {
        y -= ((ascender - typoAscender) / (ascender + Math.abs(descender))) * inlineBox.height
      }
      // TODO
      glyphIndex = undefined
      // glyphIndex = font.substitutes[font.charToGlyphIndex(content)]
    }

    if (isVertical && !set1.has(content) && (content.codePointAt(0)! <= 256 || set2.has(content))) {
      path.addCommands(
        sfnt.getPathCommands(content, x, top + baseline - (inlineBox.height - inlineBox.width) / 2, style.fontSize) ?? [],
      )
      const point = {
        y: top - (inlineBox.height - inlineBox.width) / 2 + inlineBox.height / 2,
        x: x + inlineBox.width / 2,
      }
      if (needsItalic) {
        this._italic(
          path,
          isVertical
            ? {
                x: point.x,
                y: top - (inlineBox.height - inlineBox.width) / 2 + baseline,
              }
            : undefined,
        )
      }
      path.rotate(90, point)
    }
    else {
      if (glyphIndex !== undefined) {
        path.addCommands(
          sfnt.glyphs.get(glyphIndex).getPathCommands(x, y, style.fontSize),
        )
        if (needsItalic) {
          this._italic(
            path,
            isVertical
              ? {
                  x: x + inlineBox.width / 2,
                  y: top + (typoAscender / (ascender + Math.abs(descender))) * inlineBox.height,
                }
              : undefined,
          )
        }
      }
      else {
        path.addCommands(
          sfnt.getPathCommands(content, x, y, style.fontSize) ?? [],
        )
        if (needsItalic) {
          this._italic(
            path,
            isVertical
              ? { x: x + inlineBox.height / 2, y }
              : undefined,
          )
        }
      }
    }

    const fontWeight = style.fontWeight ?? 400
    if (
      fontWeight in fontWeightMap
      && (
        (fontWeight === 700 || fontWeight === 'bold')
        && fontStyle !== 'bold'
      )
    ) {
      path.bold(fontWeightMap[fontWeight] * style.fontSize * 0.05)
    }

    path.style = {
      fill: style.color,
      stroke: style.textStrokeWidth
        ? style.textStrokeColor
        : 'none',
      strokeWidth: style.textStrokeWidth
        ? style.textStrokeWidth * style.fontSize * 0.03
        : 0,
    }
    this.path = path
    this.glyphBox = this.getGlyphBoundingBox()

    return this
  }

  protected _italic(path: Path2D, startPoint?: VectorLike): void {
    path.skew(-0.24, 0, startPoint || {
      y: this.inlineBox.top + this.baseline,
      x: this.inlineBox.left + this.inlineBox.width / 2,
    })
  }

  getGlyphMinMax(min?: Vector2, max?: Vector2, withStyle?: boolean): { min: Vector2, max: Vector2 } | undefined {
    if (this.path.paths[0]?.curves.length) {
      return this.path.getMinMax(min, max, withStyle)
    }
    else {
      return undefined
    }
  }

  getGlyphBoundingBox(withStyle?: boolean): BoundingBox | undefined {
    const minMax = this.getGlyphMinMax(undefined, undefined, withStyle)
    if (!minMax) {
      return undefined
    }
    const { min, max } = minMax
    return new BoundingBox(min.x, min.y, max.x - min.x, max.y - min.y)
  }

  drawTo(ctx: CanvasRenderingContext2D, config: Partial<TextStyle> = {}): void {
    const style = this.computedStyle
    drawPath({
      ctx,
      path: this.path,
      fontSize: style.fontSize,
      color: style.color,
      ...config,
    })
  }
}
