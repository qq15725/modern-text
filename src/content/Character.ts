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

// 字体度量 flyweight：除 advanceWidth（逐字）外，所有度量只取决于 (sfnt, fontSize)，原本每个
// Character 都重复存一份（~17 个 number）。改为按 (sfntId, fontSize) 共享一份，Character 只存一个
// 引用，度量经 getter 推导 —— 大段文本省下绝大部分逐字度量内存，且 updateGlyph 对每个 (字体,字号)
// 只算一次而非逐字算。
interface FontMetrics {
  sfnt: SFNT
  unitsPerEm: number
  advanceHeight: number
  baseline: number
  ascender: number
  descender: number
  underlinePosition: number
  underlineThickness: number
  strikeoutPosition: number
  strikeoutSize: number
  typoAscender: number
  typoDescender: number
  typoLineGap: number
  winAscent: number
  winDescent: number
  xHeight: number
  capHeight: number
  centerDiviation: number
  fontStyle?: 'bold' | 'italic'
}

const FONT_METRICS_CAP = 256
const fontMetricsCache = new Map<string, FontMetrics>()

function getFontMetrics(sfnt: SFNT, fontSize: number): FontMetrics {
  const key = `${sfntId(sfnt)}|${fontSize}`
  const cached = fontMetricsCache.get(key)
  if (cached) {
    return cached
  }
  const { hhea, os2, post, head } = sfnt
  const unitsPerEm = head.unitsPerEm
  const ascender = hhea.ascent
  const descender = hhea.descent
  const rate = unitsPerEm / fontSize
  const advanceHeight = (ascender + Math.abs(descender)) / rate
  const baseline = ascender / rate
  const m: FontMetrics = {
    sfnt,
    unitsPerEm,
    advanceHeight,
    baseline,
    ascender: ascender / rate,
    descender: descender / rate,
    underlinePosition: (ascender - post.underlinePosition) / rate,
    underlineThickness: post.underlineThickness / rate,
    strikeoutPosition: (ascender - os2.yStrikeoutPosition) / rate,
    strikeoutSize: os2.yStrikeoutSize / rate,
    typoAscender: os2.sTypoAscender / rate,
    typoDescender: os2.sTypoDescender / rate,
    typoLineGap: os2.sTypoLineGap / rate,
    winAscent: os2.usWinAscent / rate,
    winDescent: os2.usWinDescent / rate,
    xHeight: os2.version > 1 ? os2.sxHeight / rate : 0,
    capHeight: os2.version > 1 ? os2.sCapHeight / rate : 0,
    centerDiviation: advanceHeight / 2 - baseline,
    fontStyle: fsSelectionMap[os2.fsSelection] ?? macStyleMap[head.macStyle],
  }
  // 逐出（FIFO）：度量对象即便被逐出 cache 仍被引用它的 Character 持有，不影响正确性。
  if (fontMetricsCache.size >= FONT_METRICS_CAP) {
    fontMetricsCache.delete(fontMetricsCache.keys().next().value as string)
  }
  fontMetricsCache.set(key, m)
  return m
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

  inlineBox = new BoundingBox()

  // lineBox（行高/列厚那条 strip）完全由 inlineBox + fontHeight 推出，不再逐字存一个 BoundingBox。
  // 横排：与 inlineBox 同列、在内容盒上下居中、高=fontHeight；竖排：inline/block 轴交换。
  get lineBox(): BoundingBox {
    const ib = this.inlineBox
    const fh = this.fontHeight
    return this.isVertical
      ? new BoundingBox(ib.left + (ib.width - fh) / 2, ib.top, fh, ib.height)
      : new BoundingBox(ib.left, ib.top + (ib.height - fh) / 2, ib.width, fh)
  }

  glyphBox?: BoundingBox
  advanceWidth = 0
  // 字偶距（kerning）：与「行内逻辑前一字符」之间的水平调整（px，通常为负=拉近）。
  // 由 Measurer._applyKerning 在横排测量时按字形对填充；行首/换字体/竖排时为 0。
  // 断行与定位都计入它，使纯/混排拉丁文本的行宽、换行点与浏览器渲染一致。
  kerningBefore = 0
  // 本字符首字形在其 sfnt 内的索引（逐字），供相邻字符查字偶距。
  protected _glyphIndex?: number
  // 字体度量 flyweight（按 (sfnt,fontSize) 共享）；下面所有度量 getter 都从这里推导，不逐字存。
  protected _metrics?: FontMetrics

  // 度量 getter —— 零实例存储，从共享 _metrics 推导（advanceWidth 是唯一逐字存的度量）。
  get advanceHeight(): number { return this._metrics?.advanceHeight ?? 0 }
  get baseline(): number { return this._metrics?.baseline ?? 0 }
  get ascender(): number { return this._metrics?.ascender ?? 0 }
  get descender(): number { return this._metrics?.descender ?? 0 }
  get underlinePosition(): number { return this._metrics?.underlinePosition ?? 0 }
  get underlineThickness(): number { return this._metrics?.underlineThickness ?? 0 }
  get strikeoutPosition(): number { return this._metrics?.strikeoutPosition ?? 0 }
  get strikeoutSize(): number { return this._metrics?.strikeoutSize ?? 0 }
  get typoAscender(): number { return this._metrics?.typoAscender ?? 0 }
  get typoDescender(): number { return this._metrics?.typoDescender ?? 0 }
  get typoLineGap(): number { return this._metrics?.typoLineGap ?? 0 }
  get winAscent(): number { return this._metrics?.winAscent ?? 0 }
  get winDescent(): number { return this._metrics?.winDescent ?? 0 }
  get xHeight(): number { return this._metrics?.xHeight ?? 0 }
  get capHeight(): number { return this._metrics?.capHeight ?? 0 }
  get centerDiviation(): number { return this._metrics?.centerDiviation ?? 0 }
  get fontStyle(): 'bold' | 'italic' | undefined { return this._metrics?.fontStyle }

  // 增量布局：把已测量的字形整体沿 y 平移 dy（用于未变段落因前序段落高度变化而下移）。
  // 同步移动所有盒（inline/line/glyph）与 path（惰性偏移或已构建几何），保持与全量重排一致。
  translateY(dy: number): void {
    if (!dy) {
      return
    }
    this.inlineBox.top += dy
    // lineBox 由 inlineBox 派生，随之自动平移，无需单独处理。
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
    if (this.glyphBox) {
      return this.glyphBox
    }
    const size = this.computedStyle.fontSize * 0.8
    const lb = this.lineBox // derived; read once
    return this.isVertical
      ? new BoundingBox(lb.left + lb.width / 2 - size / 2, lb.top, size, lb.height)
      : new BoundingBox(lb.left, lb.top + lb.height / 2 - size / 2, lb.width, size)
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
    const { content, computedStyle } = this
    const fontSize = computedStyle.fontSize
    // 共享度量（每个 (sfnt,fontSize) 只算一次）；逐字只算 advance + 字形索引。
    this._metrics = getFontMetrics(sfnt, fontSize)
    this.advanceWidth = sfnt.getAdvanceWidth(content, fontSize)
    this._glyphIndex = sfnt.textToGlyphIndexes(content)[0]
    return this
  }

  // 与逻辑前一字符 prev 之间的字偶距（px）。仅当同一 sfnt（同字体、非缺字回退分叉）
  // 且两侧字形索引均有效时返回非零；否则 0。kerning value 为 font units，按本字符字号转 px。
  computeKerningBefore(prev?: Character): number {
    const m = this._metrics
    if (
      !prev
      || !m
      || prev._metrics?.sfnt !== m.sfnt
      || prev._glyphIndex === undefined
      || this._glyphIndex === undefined
    ) {
      return 0
    }
    const kv = m.sfnt.getKerningValue(prev._glyphIndex, this._glyphIndex)
    return kv ? (kv * this.computedStyle.fontSize) / m.unitsPerEm : 0
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
