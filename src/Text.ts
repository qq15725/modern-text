import type { Fonts } from 'modern-font'
import type { NormalizedStyle, NormalizedTextContent } from 'modern-idoc'
import type { Character } from './content'
import type { TextOptions, TextPlugin } from './types'
import { getDefaultStyle, normalizeTextContent } from 'modern-idoc'
import { BoundingBox, Vector2 } from 'modern-path2d'
import { drawPath, setupView, uploadColors } from './canvas'
import { Paragraph } from './content'
import { EventEmitter } from './EventEmitter'
import { Measurer } from './Measurer'
import { background, highlight, listStyle, outline, render, textDecoration } from './plugins'

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

export const textDefaultStyle: NormalizedStyle = getDefaultStyle()

export interface TextEventMap {
  update: { text: Text }
  measure: { text: Text, result: MeasureResult }
  render: { text: Text, view: HTMLCanvasElement, pixelRatio: number }
}

export class Text extends EventEmitter<TextEventMap> {
  debug!: boolean
  content!: NormalizedTextContent
  style!: Partial<NormalizedStyle>
  effects?: Partial<NormalizedStyle>[]
  measureDOM?: HTMLElement
  needsUpdate = true
  computedStyle: NormalizedStyle = { ...textDefaultStyle }
  paragraphs: Paragraph[] = []
  lineBox = new BoundingBox()
  rawGlyphBox = new BoundingBox()
  glyphBox = new BoundingBox()
  pathBox = new BoundingBox()
  boundingBox = new BoundingBox()
  measurer = new Measurer()
  plugins = new Map<string, TextPlugin>()
  fonts?: Fonts

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
    this.debug = options.debug ?? false
    this.content = normalizeTextContent(options.content ?? '')
    this.style = options.style ?? {}
    this.measureDOM = options.measureDOM
    this.effects = options.effects
    this.fonts = options.fonts

    this
      .use(background())
      .use(outline())
      .use(listStyle())
      .use(textDecoration())
      .use(highlight())
      .use(render())

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
    const { content, computedStyle: style } = this
    const paragraphs: Paragraph[] = []
    content.forEach((p) => {
      const { fragments, ...pStyle } = p
      const paragraph = new Paragraph(pStyle, style)
      fragments.forEach((f) => {
        const { content, ...fStyle } = f
        if (content !== undefined) {
          paragraph.addFragment(content, fStyle)
        }
      })
      paragraphs.push(paragraph)
    })
    this.paragraphs = paragraphs
    return this
  }

  createDOM(): HTMLElement {
    this.updateParagraphs()
    return this.measurer.createDOM(this.paragraphs, this.computedStyle)
  }

  measure(dom = this.measureDOM): MeasureResult {
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

  update(dom = this.measureDOM): this {
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
}
