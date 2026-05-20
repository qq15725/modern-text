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
import type { Options, Plugin } from './types'
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
  measurer = new Measurer()
  plugins = new Map<string, Plugin>()
  pathSets: Path2DSet[] = []
  protected _paragraphs: Paragraph[] = []
  protected _cachedCharacters?: Character[]
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
    await Promise.all(Array.from(this.plugins.values()).map(p => p.load?.(this)))
  }

  protected _update(): this {
    this.computedStyle = { ...textDefaultStyle, ...this.style }
    this.computedFill = this.fill ? { ...this.fill } : undefined
    this.computedOutline = this.outline ? { ...this.outline } : undefined
    this.computedEffects = this.effects?.map(v => v) ?? []
    const paragraphs: Paragraph[] = []
    this.content.forEach((p, pIndex) => {
      const { fragments, fill: pFill, outline: pOutline, ...pStyle } = p
      const paragraph = new Paragraph(pStyle, pIndex, this)
      paragraph.fill = pFill
      paragraph.outline = pOutline
      fragments.forEach((f, fIndex) => {
        const { content, fill: fFill, outline: fOutline, ...fStyle } = f
        if (content !== undefined) {
          paragraph.fragments.push(
            new Fragment(
              content,
              fStyle,
              fFill,
              fOutline,
              fIndex,
              paragraph,
            ),
          )
        }
      })
      paragraphs.push(paragraph)
    })
    this.paragraphs = paragraphs
    return this
  }

  createDom(): HTMLElement {
    this._update()
    return this.measurer.createDom(this.paragraphs, this.computedStyle)
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
    const result = this.measurer.measure(this.paragraphs, this.computedStyle, dom) as MeasureResult
    this.paragraphs = result.paragraphs
    this.lineBox = result.boundingBox
    const characters = this.characters
    for (let i = 0; i < characters.length; i++) {
      characters[i].update(this.fonts)
    }
    const glyphBox = this.getGlyphBox()
    this.rawGlyphBox = glyphBox
    this.glyphBox = glyphBox
    const updatePlugins = this._pluginsByUpdateOrder
    for (let i = 0; i < updatePlugins.length; i++) {
      updatePlugins[i].update?.(this)
    }
    const renderPlugins = this._pluginsByRenderOrder
    this.pathSets.length = 0
    for (let i = 0; i < renderPlugins.length; i++) {
      const plugin = renderPlugins[i]
      if (plugin.pathSet?.paths.length) {
        this.pathSets.push(plugin.pathSet)
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
    this.measurer.dispose()
    this._renderer = undefined
    this._rendererCtx = undefined
  }

  toString(): string {
    return this.content
      .flatMap(p => p.fragments.map(f => f.content))
      .join('')
  }
}
