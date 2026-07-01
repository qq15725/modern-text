import type { Fonts } from 'modern-font'
import type {
  FullStyle,
  NormalizedEffect,
  NormalizedFill,
  NormalizedOutline,
  NormalizedText,
  ReactivableEvents,
} from 'modern-idoc'
import type { Path2DSet } from 'modern-path2d'
import type { Character } from './content'
import type { Options, Plugin, TextMeasurer } from './types'
import { fonts as globalFonts } from 'modern-font'
import { getDefaultStyle, normalizeText, property, Reactivable } from 'modern-idoc'
import { BoundingBox, Vector2 } from 'modern-path2d'
import { Canvas2DRenderer } from './Canvas2DRenderer'
import { Fragment, Paragraph } from './content'
import { Measurer } from './Measurer'
import {
  backgroundPlugin,
  deformationPlugin,
  highlightPlugin,
  listStylePlugin,
  outlinePlugin,
  renderPlugin,
  textDecorationPlugin,
} from './plugins'

export interface RenderOptions {
  view: HTMLCanvasElement
  pixelRatio?: number
  /** 只渲染 boundingBox 内的这一子块（相对偏移 + 尺寸），用于超大文字按 GPU 上限分块栅格。 */
  region?: { x: number, y: number, width: number, height: number }
  onContext?: (context: CanvasRenderingContext2D) => void
}

export interface MeasureResult {
  paragraphs: Paragraph[]
  lineBox: BoundingBox
  rawGlyphBox: BoundingBox
  glyphBox: BoundingBox
  pathBox: BoundingBox
  boundingBox: BoundingBox
}

export const textDefaultStyle: FullStyle = getDefaultStyle()

export interface TextEvents extends ReactivableEvents {
  update: [ctx: { text: Text }]
  measure: [ctx: { text: Text, result: MeasureResult }]
  render: [ctx: { text: Text, view: HTMLCanvasElement, pixelRatio: number }]
}

// eslint-disable-next-line ts/no-unsafe-declaration-merging
export interface Text {
  on: <K extends keyof TextEvents & string>(event: K, listener: (...args: TextEvents[K]) => void) => this
  once: <K extends keyof TextEvents & string>(event: K, listener: (...args: TextEvents[K]) => void) => this
  off: <K extends keyof TextEvents & string>(event: K, listener: (...args: TextEvents[K]) => void) => this
  emit: <K extends keyof TextEvents & string>(event: K, ...args: TextEvents[K]) => this
}

// eslint-disable-next-line ts/no-unsafe-declaration-merging
export class Text extends Reactivable {
  @property({ internal: true }) declare debug: boolean
  @property() declare content: NormalizedText['content']
  @property() declare style?: NormalizedText['style']
  @property() declare effects?: NormalizedText['effects']
  @property() declare fill?: NormalizedText['fill']
  @property() declare outline?: NormalizedText['outline']
  @property() declare deformation?: NormalizedText['deformation']
  @property({ internal: true }) declare measureDom?: HTMLElement
  @property({ internal: true }) declare fonts?: Fonts

  needsUpdate = true
  computedStyle: FullStyle = { ...textDefaultStyle }
  computedFill: NormalizedFill | undefined
  computedOutline: NormalizedOutline | undefined
  computedEffects: NormalizedEffect[] = []
  inlineBox = new BoundingBox()
  lineBox = new BoundingBox()
  rawGlyphBox = new BoundingBox()
  glyphBox = new BoundingBox()
  pathBox = new BoundingBox()
  boundingBox = new BoundingBox()
  measurer: TextMeasurer = new Measurer()
  plugins = new Map<string, Plugin>()
  pathSets: Path2DSet[] = []
  protected _paragraphs: Paragraph[] = []
  protected _cachedCharacters?: Character[]
  // 增量布局开关与上一帧快照：未变段落按内容键复用，仅重排受影响段、平移后续段。
  incrementalLayout = true
  protected _prevParagraphs: Paragraph[] = []
  protected _prevContentKeys: string[] = []
  protected _prevStyleKey = ''
  // 上次测量所用的 fonts 引用：从 undefined→tree.fonts 的赋值会改变字形度量，须作废增量基准
  // （否则会复用「fonts 未就绪」时测得的零宽字形）。
  protected _prevFonts: unknown
  protected _prevFontsSet = false
  // _update 计算出的待提交快照；仅在 measure() 真正完成测量后才提交到 _prev*（见 measure），
  // 否则构造函数里的 _update（只建树不测量）会让首测误把未测量段当作可复用。
  protected _pendingContentKeys: string[] = []
  protected _pendingStyleKey = ''
  protected _pluginsByUpdateOrder: Plugin[] = []
  protected _pluginsByRenderOrder: Plugin[] = []
  protected _renderer?: Canvas2DRenderer
  protected _rendererCtx?: CanvasRenderingContext2D

  get paragraphs(): Paragraph[] {
    return this._paragraphs
  }

  set paragraphs(value: Paragraph[]) {
    this._paragraphs = value
    this._cachedCharacters = undefined
  }

  get fontSize(): number {
    return this.computedStyle.fontSize
  }

  get defaultFamily(): string {
    return this.fonts?.fallbackFont?.familySet.values().next().value ?? 'sans-serif'
  }

  get isVertical(): boolean {
    return this.computedStyle.writingMode.includes('vertical')
  }

  get characters(): Character[] {
    if (this._cachedCharacters) {
      return this._cachedCharacters
    }
    const list: Character[] = []
    const paragraphs = this._paragraphs
    for (let i = 0; i < paragraphs.length; i++) {
      const fragments = paragraphs[i].fragments
      for (let j = 0; j < fragments.length; j++) {
        const characters = fragments[j].characters
        for (let k = 0; k < characters.length; k++) {
          list.push(characters[k])
        }
      }
    }
    this._cachedCharacters = list
    return list
  }

  constructor(options: Options = {}) {
    super()

    this.set(options)
  }

  set(options: Options = {}): void {
    const {
      content,
      effects,
      style,
      measureDom,
      fonts,
      fill,
      outline,
      deformation,
    } = normalizeText(options)

    this.debug = options.debug ?? false
    this.content = content
    this.effects = effects
    this.style = style
    this.measureDom = measureDom
    this.fonts = fonts
    this.fill = fill
    this.outline = outline
    this.deformation = deformation

    this
      .use(backgroundPlugin())
      .use(outlinePlugin())
      .use(listStylePlugin())
      .use(textDecorationPlugin())
      .use(highlightPlugin())
      .use(renderPlugin())
      .use(deformationPlugin())

    ;(options.plugins ?? []).forEach((plugin) => {
      this.use(plugin)
    })

    this._update()
  }

  use(plugin: Plugin): this {
    this.plugins.set(plugin.name, plugin)
    this._resortPlugins()
    return this
  }

  protected _resortPlugins(): void {
    this._pluginsByUpdateOrder = [...this.plugins.values()]
      .sort((a, b) => (a.updateOrder ?? 0) - (b.updateOrder ?? 0))
    this._pluginsByRenderOrder = [...this.plugins.values()]
      .sort((a, b) => (a.renderOrder ?? 0) - (b.renderOrder ?? 0))
  }

  forEachCharacter(handle: (character: Character, ctx: { paragraphIndex: number, fragmentIndex: number, characterIndex: number }) => void): this {
    const paragraphs = this._paragraphs
    for (let paragraphIndex = 0; paragraphIndex < paragraphs.length; paragraphIndex++) {
      const fragments = paragraphs[paragraphIndex].fragments
      for (let fragmentIndex = 0; fragmentIndex < fragments.length; fragmentIndex++) {
        const characters = fragments[fragmentIndex].characters
        for (let characterIndex = 0; characterIndex < characters.length; characterIndex++) {
          handle(characters[characterIndex], { paragraphIndex, fragmentIndex, characterIndex })
        }
      }
    }
    return this
  }

  async load(): Promise<void> {
    this._update()
    const [decoded] = await Promise.all([
      this._decodeFonts(),
      ...Array.from(this.plugins.values()).map(p => p.load?.(this)),
    ])
    // 仅当本次有字体「首次解码就绪」时作废增量基准，强制下次 measure 全量重排 ——
    // 否则会复用「字体就绪前」测得的零宽字形（内容未变但 fonts 变了）。
    // 已解码字体的重复 load（逐键编辑）不命中此分支，增量复用照常生效。
    if (decoded > 0) {
      this._prevParagraphs = []
    }
  }

  /**
   * Eagerly decode the fonts this text uses, off the main thread — WOFF tables
   * are decompressed via modern-font's async `createSFNTAsync` (fflate async).
   * This warms the SFNT cache so the synchronous `measure()` / `render()` pass
   * never stalls the main thread inflating WOFF tables on first glyph access.
   *
   * No-op for already-decoded fonts and for formats without async decoding.
   */
  protected async _decodeFonts(): Promise<number> {
    const fonts = this.fonts ?? globalFonts
    const entries = new Set<ReturnType<Fonts['get']>>()
    for (const character of this.characters) {
      const family = character.computedStyle.fontFamily
      if (family) {
        entries.add(fonts.get(family))
      }
    }
    entries.add(fonts.fallbackFont)
    // 返回本次「新解码」的字体数：仅当确有字体首次就绪时，调用方才需作废增量基准
    // （已解码字体的重复 load —— 如逐键编辑 —— 不应触发全量重排）。
    const decoded = await Promise.all(Array.from(entries, async (entry) => {
      const font = entry?.getFont() as any
      if (font && typeof font.createSFNTAsync === 'function' && !font._sfnt) {
        font._sfnt = await font.createSFNTAsync()
        return 1
      }
      return 0
    }))
    return (decoded as number[]).reduce((a, b) => a + b, 0)
  }

  /**
   * Coerce numeric style fields to finite numbers.
   *
   * `normalizeText`/`normalizeStyle` only runs through the constructor, so a
   * `style` provided via direct assignment or `setPropertyAccessor` reaches
   * `computedStyle` un-normalized. An invalid numeric value (`''`, `NaN`,
   * `'10px'`, `'50%'`) would then poison layout arithmetic — e.g.
   * `textIndent ?? 0` keeps `''` (`??` does not catch empty strings), which
   * corrupts glyph positions and the text fails to render. Fall every numeric
   * field back to its default when it is not a finite number (parsing leading
   * numerics like `parseFloat`, matching the normalized path).
   */
  protected _normalizeComputedStyle(style: FullStyle): FullStyle {
    const result = style as Record<string, any>
    for (const key in textDefaultStyle) {
      const fallback = (textDefaultStyle as Record<string, any>)[key]
      if (typeof fallback !== 'number') {
        continue
      }
      const value = result[key]
      if (typeof value === 'number') {
        if (!Number.isFinite(value)) {
          result[key] = fallback
        }
      }
      else {
        const parsed = Number.parseFloat(value)
        result[key] = Number.isFinite(parsed) ? parsed : fallback
      }
    }
    return style
  }

  protected _buildParagraph(p: NormalizedText['content'][number], pIndex: number): Paragraph {
    const { fragments, fill: pFill, outline: pOutline, ...pStyle } = p
    const paragraph = new Paragraph(pStyle, pIndex, this)
    paragraph.fill = pFill
    paragraph.outline = pOutline
    fragments.forEach((f, fIndex) => {
      const { content, fill: fFill, outline: fOutline, ...fStyle } = f
      if (content !== undefined) {
        paragraph.fragments.push(
          new Fragment(content, fStyle, fFill, fOutline, fIndex, paragraph),
        )
      }
    })
    return paragraph
  }

  // 仅当根级样式/填充/描边/特效/形变未变、且非竖排、非块级垂直对齐位移时，才允许复用未变段落
  // （这些会改变各段 computedStyle 或全局位移，复用会得到错误结果）。
  protected _canReuseLayout(styleKey: string): boolean {
    if (!this.incrementalLayout || !this._prevParagraphs.length) {
      return false
    }
    if (styleKey !== this._prevStyleKey) {
      return false
    }
    // fonts 引用变化（典型：首次挂载到 tree 后由 undefined 变为 tree.fonts）→ 度量会变，不可复用。
    if (!this._prevFontsSet || this.fonts !== this._prevFonts) {
      return false
    }
    // 变形是破坏性的：deform 原地改写字形 path 控制点，并把变形后的框写回 glyphBox/inlineBox。
    // 若复用布局，下一帧会在「上一帧的变形结果」上再次变形，多次 measure 后层层叠加、字形崩坏
    // （放大成黑块、字符四散）。有变形时禁用增量复用，每帧全量重排 → 干净布局 → 变形对 measure 幂等。
    const deformType = this.deformation?.type
    if (deformType && deformType !== 'none') {
      return false
    }
    const cs = this.computedStyle
    if (cs.writingMode.includes('vertical')) {
      return false
    }
    if (typeof cs.height === 'number' && (cs.verticalAlign === 'middle' || cs.verticalAlign === 'bottom')) {
      return false
    }
    return true
  }

  protected _update(): this {
    this.computedStyle = this._normalizeComputedStyle({ ...textDefaultStyle, ...this.style })
    this.computedFill = this.fill ? { ...this.fill } : undefined
    this.computedOutline = this.outline ? { ...this.outline } : undefined
    this.computedEffects = this.effects?.map(v => v) ?? []

    // 根级布局/渲染相关项的快照键：任一变化都强制全量重排（各段 computedStyle 会变）。
    const styleKey = JSON.stringify([this.style, this.fill, this.outline, this.effects, this.deformation])
    const reuse = this._canReuseLayout(styleKey)

    const content = this.content
    const contentKeys: string[] = Array.from({ length: content.length })
    const paragraphs: Paragraph[] = Array.from({ length: content.length })
    for (let i = 0; i < content.length; i++) {
      const key = JSON.stringify(content[i])
      contentKeys[i] = key
      const prev = this._prevParagraphs[i]
      if (reuse && prev && prev._layoutValid && this._prevContentKeys[i] === key) {
        // 内容/样式在同一索引位未变 → 复用已测量段落，仅标记可平移（measurer 据 dy 平移）。
        prev._layoutDirty = false
        paragraphs[i] = prev
      }
      else {
        const para = this._buildParagraph(content[i], i)
        para._layoutDirty = true
        paragraphs[i] = para
      }
    }

    this.paragraphs = paragraphs
    // 暂存快照；measure() 完成测量后才提交到 _prev*（避免复用未测量段）。
    this._pendingContentKeys = contentKeys
    this._pendingStyleKey = styleKey
    return this
  }

  measure(dom = this.measureDom): MeasureResult {
    const old = {
      paragraphs: this.paragraphs,
      inlineBox: this.inlineBox,
      lineBox: this.lineBox,
      rawGlyphBox: this.rawGlyphBox,
      glyphBox: this.glyphBox,
      pathBox: this.pathBox,
      boundingBox: this.boundingBox,
    }
    this._update()
    const result = this.measurer.measure(this.paragraphs, this.computedStyle, dom, this.fonts) as MeasureResult
    this.paragraphs = result.paragraphs
    this.lineBox = result.boundingBox
    // 增量：仅重排段（_layoutDirty）需要重建 path/glyphBox；未变段的字形已由 measurer 平移到位。
    const paragraphs = this.paragraphs
    for (let pi = 0; pi < paragraphs.length; pi++) {
      const paragraph = paragraphs[pi]
      if (!paragraph._layoutDirty) {
        continue
      }
      for (const fragment of paragraph.fragments) {
        const chars = fragment.characters
        for (let i = 0; i < chars.length; i++) {
          chars[i].update(this.fonts)
        }
      }
    }
    const glyphBox = this._computeGlyphBox()
    this.rawGlyphBox = glyphBox
    this.glyphBox = glyphBox
    // 测量完成：把本次（已测量的）段落与快照提交为下次增量复用的基准。
    this._prevParagraphs = this.paragraphs
    this._prevContentKeys = this._pendingContentKeys
    this._prevStyleKey = this._pendingStyleKey
    this._prevFonts = this.fonts
    this._prevFontsSet = true
    const updatePlugins = this._pluginsByUpdateOrder
    for (let i = 0; i < updatePlugins.length; i++) {
      updatePlugins[i].update?.(this)
    }
    const renderPlugins = this._pluginsByRenderOrder
    this.pathSets.length = 0
    for (let i = 0; i < renderPlugins.length; i++) {
      const plugin = renderPlugins[i]
      // 用 _lazyCount（若有）判断是否产出 path，避免读取 .paths 触发惰性逐字 path 构建。
      const ps = plugin.pathSet
      const count = (ps as any)?._lazyCount ?? ps?.paths.length
      if (ps && count) {
        this.pathSets.push(ps)
      }
    }
    this
      ._updateInlineBox()
      ._updatePathBox()
      ._updateBoundingBox()
    // Swap: capture the freshly computed state into `result` and restore `this` to its prior state,
    // so `measure()` itself stays non-destructive (use `update()` to commit).
    for (const key in old) {
      const next = (this as any)[key]
      ;(this as any)[key] = (old as any)[key]
      ;(result as any)[key] = next
    }
    this.emit('measure', { text: this, result })
    return result
  }

  getGlyphBox(): BoundingBox {
    const min = Vector2.MAX
    const max = Vector2.MIN
    const characters = this.characters
    for (let i = 0; i < characters.length; i++) {
      const character = characters[i]
      if (character.getGlyphMinMax(min, max)) {
        continue
      }
      const { left, top, width, height } = character.inlineBox
      const topLeft = new Vector2(left, top)
      const bottomRight = new Vector2(left + width, top + height)
      min.clampMin(topLeft, bottomRight)
      max.clampMax(topLeft, bottomRight)
    }

    if (
      min.x === Number.MIN_SAFE_INTEGER
      || min.y === Number.MIN_SAFE_INTEGER
      || max.x === Number.MAX_SAFE_INTEGER
      || max.y === Number.MAX_SAFE_INTEGER
    ) {
      return new BoundingBox(0, 0, 0, 0)
    }

    return new BoundingBox(
      min.x,
      min.y,
      max.x - min.x,
      max.y - min.y,
    )
  }

  // 单段字形包围盒（绝对坐标），逻辑与 getGlyphBox 等价但只覆盖一段；空段返回 undefined。
  protected _paragraphGlyphBox(paragraph: Paragraph): BoundingBox | undefined {
    const min = Vector2.MAX
    const max = Vector2.MIN
    const fragments = paragraph.fragments
    for (let fi = 0; fi < fragments.length; fi++) {
      const chars = fragments[fi].characters
      for (let i = 0; i < chars.length; i++) {
        const character = chars[i]
        if (character.getGlyphMinMax(min, max)) {
          continue
        }
        const { left, top, width, height } = character.inlineBox
        min.clampMin(new Vector2(left, top), new Vector2(left + width, top + height))
        max.clampMax(new Vector2(left, top), new Vector2(left + width, top + height))
      }
    }
    // 空段（无字形且无字符，如尾随换行的空行）：min/max 仍为 ±Infinity → 无贡献。
    if (
      !Number.isFinite(min.x)
      || !Number.isFinite(min.y)
      || !Number.isFinite(max.x)
      || !Number.isFinite(max.y)
    ) {
      return undefined
    }
    return new BoundingBox(min.x, min.y, max.x - min.x, max.y - min.y)
  }

  // 增量版整体字形盒：仅重排段重算并缓存 _glyphBox，未变段复用已平移的缓存，再并集。
  protected _computeGlyphBox(): BoundingBox {
    const paragraphs = this.paragraphs
    const boxes: BoundingBox[] = []
    for (let pi = 0; pi < paragraphs.length; pi++) {
      const paragraph = paragraphs[pi]
      let pbox = paragraph._glyphBox
      if (paragraph._layoutDirty || !pbox) {
        pbox = this._paragraphGlyphBox(paragraph)
        paragraph._glyphBox = pbox
      }
      if (pbox) {
        boxes.push(pbox)
      }
    }
    return boxes.length ? BoundingBox.from(...boxes) : new BoundingBox(0, 0, 0, 0)
  }

  protected _updateInlineBox(): this {
    const boxes: BoundingBox[] = []
    const paragraphs = this._paragraphs
    for (let i = 0; i < paragraphs.length; i++) {
      const fragments = paragraphs[i].fragments
      for (let j = 0; j < fragments.length; j++) {
        boxes.push(fragments[j].inlineBox)
      }
    }
    this.inlineBox = BoundingBox.from(...boxes)
    return this
  }

  protected _updatePathBox(): this {
    const boxes: BoundingBox[] = [this.glyphBox]
    for (const plugin of this.plugins.values()) {
      const box = plugin.getBoundingBox
        ? plugin.getBoundingBox(this)
        : plugin.pathSet?.getBoundingBox()
      if (box) {
        boxes.push(box)
      }
    }
    this.pathBox = BoundingBox.from(...boxes)
    return this
  }

  protected _updateBoundingBox(): this {
    this.boundingBox = BoundingBox.from(
      this.rawGlyphBox,
      this.lineBox,
      this.pathBox,
    )
    return this
  }

  requestUpdate(): this {
    this.needsUpdate = true
    return this
  }

  update(dom = this.measureDom): this {
    this.needsUpdate = false
    Object.assign(this, this.measure(dom))
    this.emit('update', { text: this })
    return this
  }

  protected _getRenderer(ctx: CanvasRenderingContext2D): Canvas2DRenderer {
    if (!this._renderer || this._rendererCtx !== ctx) {
      this._renderer = new Canvas2DRenderer(this, ctx)
      this._rendererCtx = ctx
    }
    return this._renderer
  }

  render(options: RenderOptions): void {
    const { view, pixelRatio = 2 } = options

    const ctx = view.getContext('2d')
    if (!ctx) {
      return
    }

    if (this.needsUpdate) {
      this.update()
    }

    const renderer = this._getRenderer(ctx)
    renderer.pixelRatio = pixelRatio
    renderer.region = options.region
    renderer.setup()

    const renderPlugins = this._pluginsByRenderOrder
    for (let i = 0; i < renderPlugins.length; i++) {
      const plugin = renderPlugins[i]
      if (plugin.render) {
        plugin.render(renderer)
      }
      else if (plugin.pathSet) {
        const paths = plugin.pathSet.paths
        for (let j = 0; j < paths.length; j++) {
          renderer.drawPath(paths[j])
        }
      }
    }

    this.emit('render', { text: this, view, pixelRatio })

    options.onContext?.(ctx)
  }

  dispose(): void {
    this.measurer.dispose?.()
    this._renderer = undefined
    this._rendererCtx = undefined
  }

  toString(): string {
    return this.content
      .flatMap(p => p.fragments.map(f => f.content))
      .join('')
  }
}
