import type { Fonts } from 'modern-font'
import type { FullStyle, NormalizedText, ReactivableEvents } from 'modern-idoc'
import type { Path2DSet } from 'modern-path2d'
import type { Character } from './content'
import type { TextOptions, TextPlugin } from './types'
import { getDefaultStyle, normalizeText, property, Reactivable } from 'modern-idoc'
import { BoundingBox, Vector2 } from 'modern-path2d'
import { drawPath, setupView, uploadColors } from './canvas'
import { Fragment, Paragraph } from './content'
import { Measurer } from './Measurer'
import {
  backgroundPlugin,
  highlightPlugin,
  listStylePlugin,
  outlinePlugin,
  renderPlugin,
  textDecorationPlugin,
} from './plugins'

export interface TextRenderOptions {
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
  update: (ctx: { text: Text }) => void
  measure: (ctx: { text: Text, result: MeasureResult }) => void
  render: (ctx: { text: Text, view: HTMLCanvasElement, pixelRatio: number }) => void
}

// eslint-disable-next-line ts/no-unsafe-declaration-merging
export interface Text {
  on: <K extends keyof TextEvents>(event: K, listener: TextEvents[K]) => this
  once: <K extends keyof TextEvents>(event: K, listener: TextEvents[K]) => this
  off: <K extends keyof TextEvents>(event: K, listener?: TextEvents[K]) => this
  emit: <K extends keyof TextEvents>(event: K, ...args: Parameters<TextEvents[K]>) => this
}

// eslint-disable-next-line ts/no-unsafe-declaration-merging
export class Text extends Reactivable {
  @property() declare debug: boolean
  @property() declare content: NormalizedText['content']
  @property() declare style?: NormalizedText['style']
  @property() declare effects?: NormalizedText['effects']
  @property() declare fill?: NormalizedText['fill']
  @property() declare outline?: NormalizedText['outline']
  @property() declare measureDom?: HTMLElement
  @property() declare fonts?: Fonts

  needsUpdate = true
  computedStyle: FullStyle = { ...textDefaultStyle }
  paragraphs: Paragraph[] = []
  lineBox = new BoundingBox()
  rawGlyphBox = new BoundingBox()
  glyphBox = new BoundingBox()
  pathBox = new BoundingBox()
  boundingBox = new BoundingBox()
  measurer = new Measurer()
  plugins = new Map<string, TextPlugin>()
  pathSets: Path2DSet[] = []

  get fontSize(): number {
    return this.computedStyle.fontSize
  }

  get isVertical(): boolean {
    return this.computedStyle.writingMode.includes('vertical')
  }

  get characters(): Character[] {
    return this.paragraphs.flatMap(p => p.fragments.flatMap(f => f.characters))
  }

  constructor(options: TextOptions = {}) {
    super()

    this.set(options)
  }

  set(options: TextOptions = {}): void {
    const {
      content,
      effects,
      style,
      measureDom,
      fonts,
      fill,
      outline,
    } = normalizeText(options)

    this.debug = options.debug ?? false
    this.content = content
    this.effects = effects
    this.style = style
    this.measureDom = measureDom
    this.fonts = fonts
    this.fill = fill
    this.outline = outline

    this
      .use(backgroundPlugin())
      .use(outlinePlugin())
      .use(listStylePlugin())
      .use(textDecorationPlugin())
      .use(highlightPlugin())
      .use(renderPlugin())

    ;(options.plugins ?? []).forEach((plugin) => {
      this.use(plugin)
    })

    this.updateParagraphs()
  }

  use(plugin: TextPlugin): this {
    this.plugins.set(plugin.name, plugin)
    return this
  }

  forEachCharacter(handle: (character: Character, ctx: { paragraphIndex: number, fragmentIndex: number, characterIndex: number }) => void): this {
    this.paragraphs.forEach((p, paragraphIndex) => {
      p.fragments.forEach((f, fragmentIndex) => {
        f.characters.forEach((c, characterIndex) => {
          handle(c, { paragraphIndex, fragmentIndex, characterIndex })
        })
      })
    })
    return this
  }

  async load(): Promise<void> {
    await Promise.all(Array.from(this.plugins.values()).map(p => p.load?.(this)))
  }

  updateParagraphs(): this {
    this.computedStyle = { ...textDefaultStyle, ...this.style }
    const { content } = this
    const paragraphs: Paragraph[] = []
    content.forEach((p, pIndex) => {
      const { fragments, fill: pFill, outline: pOutline, ...pStyle } = p
      const paragraph = new Paragraph(pStyle, pIndex, this)
      paragraph.fill = pFill
      paragraph.outline = pOutline
      fragments.forEach((f, fIndex) => {
        const { content, fill: fFill, outline: fOutline, ...fStyle } = f
        if (content !== undefined) {
          const fragment = new Fragment(content, fStyle, fIndex, paragraph)
          paragraph.fragments.push(fragment)
          fragment.fill = fFill
          fragment.outline = fOutline
        }
      })
      paragraphs.push(paragraph)
    })
    this.paragraphs = paragraphs
    return this
  }

  createDom(): HTMLElement {
    this.updateParagraphs()
    return this.measurer.createDom(this.paragraphs, this.computedStyle)
  }

  measure(dom = this.measureDom): MeasureResult {
    const old = {
      paragraphs: this.paragraphs,
      lineBox: this.lineBox,
      rawGlyphBox: this.rawGlyphBox,
      glyphBox: this.glyphBox,
      pathBox: this.pathBox,
      boundingBox: this.boundingBox,
    }
    this.updateParagraphs()
    const result = this.measurer.measure(this.paragraphs, this.computedStyle, dom) as MeasureResult
    this.paragraphs = result.paragraphs
    this.lineBox = result.boundingBox
    this.characters.forEach((c) => {
      c.update(this.fonts)
    })
    this.rawGlyphBox = this.getGlyphBox()
    Array.from(this.plugins.values())
      .sort((a, b) => (a.updateOrder ?? 0) - (b.updateOrder ?? 0))
      .forEach((plugin) => {
        plugin.update?.(this)
      })
    this.pathSets.length = 0
    Array.from(this.plugins.values())
      .sort((a, b) => (a.renderOrder ?? 0) - (b.renderOrder ?? 0))
      .forEach((plugin) => {
        if (plugin.pathSet?.paths.length) {
          this.pathSets.push(plugin.pathSet)
        }
      })
    this.glyphBox = this.getGlyphBox()
    this
      .updatePathBox()
      .updateBoundingBox()
    for (const key in old) {
      ;(result as any)[key] = (this as any)[key]
      ;(this as any)[key] = (old as any)[key]
    }
    this.emit('measure', { text: this, result })
    return result
  }

  getGlyphBox(): BoundingBox {
    const min = Vector2.MAX
    const max = Vector2.MIN
    this.characters.forEach((c) => {
      if (!c.getGlyphMinMax(min, max)) {
        const { inlineBox: glyphBox } = c
        const { left, top, width, height } = glyphBox
        const a = new Vector2(left, top)
        const b = new Vector2(left + width, top + height)
        min.min(a, b)
        max.max(a, b)
      }
    })
    return new BoundingBox(
      min.x,
      min.y,
      max.x - min.x,
      max.y - min.y,
    )
  }

  updatePathBox(): this {
    this.pathBox = BoundingBox.from(
      this.glyphBox,
      ...Array.from(this.plugins.values())
        .map((plugin) => {
          return plugin.getBoundingBox
            ? plugin.getBoundingBox(this)
            : plugin.pathSet?.getBoundingBox()
        })
        .filter(Boolean) as BoundingBox[],
    )
    return this
  }

  updateBoundingBox(): this {
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
    const result = this.measure(dom)
    for (const key in result) {
      (this as any)[key] = (result as any)[key]
    }
    this.emit('update', { text: this })
    this.needsUpdate = false
    return this
  }

  render(options: TextRenderOptions): void {
    const { view, pixelRatio = 2 } = options

    const ctx = view.getContext('2d')
    if (!ctx) {
      return
    }

    if (this.needsUpdate) {
      this.update()
    }

    setupView(ctx, pixelRatio, this.boundingBox)
    uploadColors(ctx, this)

    Array.from(this.plugins.values())
      .sort((a, b) => (a.renderOrder ?? 0) - (b.renderOrder ?? 0))
      .forEach((plugin) => {
        if (plugin.render) {
          plugin.render?.(ctx, this)
        }
        else if (plugin.pathSet) {
          const style = this.computedStyle
          plugin.pathSet.paths.forEach((path) => {
            drawPath({
              ctx,
              path,
              fontSize: style.fontSize,
            })
          })
        }
      })

    this.emit('render', { text: this, view, pixelRatio })

    options.onContext?.(ctx)
  }

  toString(): string {
    return this.content
      .flatMap(p => p.fragments.map(f => f.content))
      .join('')
  }
}
