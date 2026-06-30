import type { Fonts, SFNT } from 'modern-font'
import type { FontWeight, FullStyle, NormalizedFill, NormalizedOutline } from 'modern-idoc'
import type { Vector2Like } from 'modern-path2d'
import type { Fragment } from './Fragment'
import { fonts as globalFonts } from 'modern-font'
import { clearUndef } from 'modern-idoc'
import { BoundingBox, Path2D, Vector2 } from 'modern-path2d'

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

// 字形几何缓存：把「位置无关」的字形 path（原点处，已烤入合成 bold）+ 局部 glyphBox 按
// (字符, 字体, 字号, bold量) 缓存。同字同样式在大段文本里大量复现，命中后只需 clone+平移，
// 跳过 sfnt.getPathCommands 重缩放、addCommands 逐点构造曲线、getMinMax 求包围盒
// （实测三者是 Text.update 的主成本）。位置/描边/颜色是逐字附加，不进 key。
interface GlyphTemplate {
  path: Path2D
  glyphBox?: BoundingBox
}

const GLYPH_CACHE_CAP = 4096
const glyphCache = new Map<string, GlyphTemplate>()

function glyphCacheSet(key: string, tmpl: GlyphTemplate): void {
  glyphCache.set(key, tmpl)
  if (glyphCache.size > GLYPH_CACHE_CAP) {
    glyphCache.delete(glyphCache.keys().next().value as string)
  }
}

// 用 sfnt 实例身份作 key 的一部分：fontFamily 相同但缺字回退到 fallback 字体时，
// 字形其实不同，仅靠 fontFamily 串键会冲突。
let _sfntIdCounter = 0
const _sfntIds = new WeakMap<object, number>()
function sfntId(sfnt: object): number {
  let id = _sfntIds.get(sfnt)
  if (id === undefined) {
    id = ++_sfntIdCounter
    _sfntIds.set(sfnt, id)
  }
  return id
}

export class Character {
  // 惰性 path：布局阶段（measure）只算度量 + glyphBox，不构造逐字定位 path
  // （3681 字逐字 clone+平移占 Text.update 主成本）。path 仅在真正渲染/命中时才按需构建。
  protected _path?: Path2D<Character>
  protected _lazyPath?: { tmpl: GlyphTemplate, x: number, y: number, style: any }

  get path(): Path2D<Character> {
    if (this._path) {
      return this._path
    }
    const lazy = this._lazyPath
    if (lazy) {
      const { x, y } = lazy
      const p = lazy.tmpl.path.clone().setMeta(this)
      p.applyTransform((pt) => {
        pt.x += x
        pt.y += y
      })
      p.style = lazy.style
      this._path = p
      this._lazyPath = undefined
      return p
    }
    const empty = new Path2D<Character>().setMeta(this)
    this._path = empty
    return empty
  }

  set path(value: Path2D<Character>) {
    this._path = value
    this._lazyPath = undefined
  }

  lineBox = new BoundingBox()
  inlineBox = new BoundingBox()
  glyphBox?: BoundingBox
  advanceWidth = 0
  advanceHeight = 0
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

  // 字偶距（kerning）：与「行内逻辑前一字符」之间的水平调整（px，通常为负=拉近）。
  // 由 Measurer._applyKerning 在横排测量时按字形对填充；行首/换字体/竖排时为 0。
  // 断行与定位都计入它，使纯/混排拉丁文本的行宽、换行点与浏览器渲染一致。
  kerningBefore = 0
  // kerning 查询所需的字形身份（measureGlyph 时记录）：同一 sfnt 的相邻字形才有字偶距。
  protected _sfnt?: SFNT
  protected _glyphIndex?: number
  protected _unitsPerEm = 0

  // 增量布局：把已测量的字形整体沿 y 平移 dy（用于未变段落因前序段落高度变化而下移）。
  // 同步移动所有盒（inline/line/glyph）与 path（惰性偏移或已构建几何），保持与全量重排一致。
  translateY(dy: number): void {
    if (!dy) {
      return
    }
    this.inlineBox.top += dy
    this.lineBox.top += dy
    if (this.glyphBox) {
      this.glyphBox.top += dy
    }
    if (this._lazyPath) {
      this._lazyPath.y += dy
    }
    else if (this._path) {
      this._path.applyTransform((p) => {
        p.y += dy
      })
    }
  }

  get compatibleGlyphBox(): BoundingBox {
    const size = this.computedStyle.fontSize * 0.8
    return this.glyphBox ?? (
      this.isVertical
        ? new BoundingBox(
            this.lineBox.left + this.lineBox.width / 2 - size / 2,
            this.lineBox.top,
            size,
            this.lineBox.height,
          )
        : new BoundingBox(
            this.lineBox.left,
            this.lineBox.top + this.lineBox.height / 2 - size / 2,
            this.lineBox.width,
            size,
          )
    )
  }

  get center(): Vector2 {
    return this.compatibleGlyphBox.center
  }

  get computedFill(): NormalizedFill | undefined {
    return this.parent.computedFill
  }

  get computedOutline(): NormalizedOutline | undefined {
    return this.parent.computedOutline
  }

  get computedStyle(): FullStyle {
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

  protected _getFontSFNT(fonts?: Fonts): SFNT | undefined {
    const fontFamily = this.computedStyle.fontFamily
    const _fonts = (fonts ?? globalFonts)
    const font = fontFamily
      ? _fonts.get(fontFamily)
      : _fonts.fallbackFont
    let sfnt = font?.getSFNT()
    if (sfnt?.textToGlyphIndexes(this.content).includes(0)) {
      sfnt = _fonts.fallbackFont?.getSFNT()
    }
    return sfnt
  }

  updateGlyph(sfnt = this._getFontSFNT()): this {
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
    this.advanceWidth = advanceWidth
    this.advanceHeight = advanceHeight
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
    this.xHeight = os2.version > 1 ? os2.sxHeight / rate : 0
    this.capHeight = os2.version > 1 ? os2.sCapHeight / rate : 0
    this.baseline = baseline
    this.centerDiviation = advanceHeight / 2 - baseline
    this.fontStyle = fsSelectionMap[os2.fsSelection] ?? macStyleMap[head.macStyle]
    // kerning 身份：本字符首字形在该 sfnt 内的索引，供相邻字符查字偶距。
    this._sfnt = sfnt
    this._unitsPerEm = unitsPerEm
    this._glyphIndex = sfnt.textToGlyphIndexes(content)[0]
    return this
  }

  // 与逻辑前一字符 prev 之间的字偶距（px）。仅当同一 sfnt（同字体、非缺字回退分叉）
  // 且两侧字形索引均有效时返回非零；否则 0。kerning value 为 font units，按本字符字号转 px。
  computeKerningBefore(prev?: Character): number {
    const sfnt = this._sfnt
    if (
      !prev
      || !sfnt
      || prev._sfnt !== sfnt
      || prev._glyphIndex === undefined
      || this._glyphIndex === undefined
      || this._unitsPerEm <= 0
    ) {
      return 0
    }
    const kv = sfnt.getKerningValue(prev._glyphIndex, this._glyphIndex)
    return kv ? (kv * this.computedStyle.fontSize) / this._unitsPerEm : 0
  }

  /**
   * Populate glyph metrics only (advance width/height, ascender/descender,
   * baseline, …) without building the glyph `path` or touching boxes.
   *
   * The pure-JS `Measurer` must know advances *before* it can place characters,
   * so it calls this ahead of layout. `update()` later recomputes the same metrics
   * while building the path, so this is idempotent.
   */
  measureGlyph(fonts?: Fonts): this {
    return this.updateGlyph(this._getFontSFNT(fonts))
  }

  update(fonts?: Fonts): this {
    const sfnt = this._getFontSFNT(fonts)

    if (!sfnt) {
      return this
    }

    this.updateGlyph(sfnt)

    const style = this.computedStyle
    const needsItalic = style.fontStyle === 'italic' && this.fontStyle !== 'italic'
    // 快路径：横排 + 无需合成斜体 + 无描边（占正文绝大多数）→ 走字形模板缓存。
    // 竖排/合成斜体（位置相关的旋转/skew）、描边（glyphBox 含描边扩展）仍走全量构建。
    if (!this.isVertical && !needsItalic && !style.textStrokeWidth) {
      this._updateFromCache(sfnt, style)
      return this
    }

    const {
      isVertical,
      content,
      baseline,
      inlineBox,
      ascender,
      descender,
      typoAscender,
      fontStyle,
      advanceWidth,
      advanceHeight,
    } = this

    const { left, top } = inlineBox

    let x = left
    let y = top + baseline
    let glyphIndex: number | undefined
    const path = new Path2D<Character>().setMeta(this)

    if (isVertical) {
      x += (advanceHeight - advanceWidth) / 2
      if (Math.abs(advanceWidth - advanceHeight) > 0.1) {
        y -= ((ascender - typoAscender) / (ascender + Math.abs(descender))) * advanceHeight
      }
      // TODO
      glyphIndex = undefined
      // glyphIndex = font.substitutes[font.charToGlyphIndex(content)]
    }

    if (
      isVertical
      && !set1.has(content)
      && (content.codePointAt(0)! <= 256 || set2.has(content))
    ) {
      path.addCommands(
        sfnt.getPathCommands(
          content,
          x,
          top + baseline - (advanceHeight - advanceWidth) / 2,
          style.fontSize,
        ),
      )
      const point = {
        y: top - (advanceHeight - advanceWidth) / 2 + advanceHeight / 2,
        x: x + advanceWidth / 2,
      }
      if (needsItalic) {
        this._italic(path, {
          x: point.x,
          y: top - (advanceHeight - advanceWidth) / 2 + baseline,
        })
      }
      path.rotate(Math.PI / 2, point)
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
                  x: x + advanceWidth / 2,
                  y: top + (typoAscender / (ascender + Math.abs(descender))) * advanceHeight,
                }
              : undefined,
          )
        }
      }
      else {
        path.addCommands(sfnt.getPathCommands(content, x, y, style.fontSize))
        if (needsItalic) {
          this._italic(
            path,
            isVertical
              ? { x: x + advanceHeight / 2, y }
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

    path.style = clearUndef({
      fill: style.color,
      fillRule: 'nonzero',
      stroke: style.textStrokeWidth
        ? style.textStrokeColor
        : undefined,
      strokeWidth: style.textStrokeWidth
        ? style.textStrokeWidth * style.fontSize * 0.03
        : undefined,
    })

    this.path = path
    this.glyphBox = this.getGlyphBoundingBox()

    return this
  }

  // 横排非合成斜体的快路径：用字形模板缓存构建 path 与 glyphBox。
  protected _updateFromCache(sfnt: SFNT, style: FullStyle): void {
    const content = this.content
    const fontSize = style.fontSize
    const x = this.inlineBox.left
    const y = this.inlineBox.top + this.baseline
    const fontWeight = style.fontWeight ?? 400
    const boldAmount = (
      fontWeight in fontWeightMap
      && (fontWeight === 700 || fontWeight === 'bold')
      && this.fontStyle !== 'bold'
    )
      ? fontWeightMap[fontWeight] * fontSize * 0.05
      : 0

    const key = `${content}|${sfntId(sfnt)}|${fontSize}|${boldAmount}`
    let tmpl = glyphCache.get(key)
    if (!tmpl) {
      // 原点处构建一次字形模板（位置无关）。
      const tpath = new Path2D()
      tpath.addCommands(sfnt.getPathCommands(content, 0, 0, fontSize))
      if (boldAmount) {
        tpath.bold(boldAmount)
      }
      let glyphBox: BoundingBox | undefined
      if (tpath.curves[0]?.curves.length) {
        // 与慢路径 getGlyphBoundingBox() 默认一致（withStyle，模板无样式时等同纯几何）。
        const { min, max } = tpath.getMinMax(undefined, undefined, true)
        glyphBox = new BoundingBox(min.x, min.y, max.x - min.x, max.y - min.y)
      }
      tmpl = { path: tpath, glyphBox }
      glyphCacheSet(key, tmpl)
    }

    // 不在此构造定位 path：只记录「模板 + 平移 + 样式」，渲染/命中时经 get path 惰性 clone。
    // glyphBox 直接由模板局部盒平移得到（O(1)），供布局/包围盒用，无需 path。
    this._path = undefined
    this._lazyPath = {
      tmpl,
      x,
      y,
      style: clearUndef({ fill: style.color, fillRule: 'nonzero' }),
    }
    this.glyphBox = tmpl.glyphBox
      ? new BoundingBox(tmpl.glyphBox.left + x, tmpl.glyphBox.top + y, tmpl.glyphBox.width, tmpl.glyphBox.height)
      : undefined
  }

  protected _italic(path: Path2D, startPoint?: Vector2Like): void {
    path.skew(-0.24, 0, startPoint || {
      y: this.inlineBox.top + this.baseline,
      x: this.inlineBox.left + this.inlineBox.width / 2,
    })
  }

  getGlyphMinMax(min?: Vector2, max?: Vector2, withStyle?: boolean): { min: Vector2, max: Vector2 } | undefined {
    // 惰性 path 尚未构建时用缓存 glyphBox 求 min/max，避免为求布局包围盒触发逐字 path 构建。
    // （快路径无描边，glyphBox 已等同 withStyle 几何盒。）
    if (this._path === undefined && this._lazyPath !== undefined) {
      const gb = this.glyphBox
      if (!gb) {
        return undefined
      }
      const tl = new Vector2(gb.left, gb.top)
      const br = new Vector2(gb.left + gb.width, gb.top + gb.height)
      const rMin = min ?? new Vector2(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER)
      const rMax = max ?? new Vector2(Number.MIN_SAFE_INTEGER, Number.MIN_SAFE_INTEGER)
      rMin.clampMin(tl, br)
      rMax.clampMax(tl, br)
      return { min: rMin, max: rMax }
    }
    if (this.path.curves[0]?.curves.length) {
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
}
