import type { Fonts } from 'modern-font'
import type { StyleDeclaration, TextContent } from 'modern-idoc'
import type { Character } from './content'
import type { TextOptions, TextPlugin } from './types'
import { getDefaultStyle } from 'modern-idoc'
import { BoundingBox, Vector2 } from 'modern-path2d'
import { drawPath, setupView, uploadColors } from './canvas'
import { Paragraph } from './content'
import { EventEmitter } from './EventEmitter'
import { Measurer } from './Measurer'
import { background, highlight, listStyle, outline, render, textDecoration } from './plugins'

export interface TextRenderOptions {
  view: HTMLCanvasElement
  pixelRatio?: number
}

export interface MeasureResult {
  paragraphs: Paragraph[]
  lineBox: BoundingBox
  rawGlyphBox: BoundingBox
  glyphBox: BoundingBox
  pathBox: BoundingBox
  boundingBox: BoundingBox
}

export const textDefaultStyle: StyleDeclaration = getDefaultStyle()

export interface TextEventMap {
  update: { text: Text }
  measure: { text: Text, result: MeasureResult }
  render: { text: Text, view: HTMLCanvasElement, pixelRatio: number }
}

export class Text extends EventEmitter<TextEventMap> {
  debug: boolean
  content: TextContent
  style: Partial<StyleDeclaration>
  effects?: Partial<StyleDeclaration>[]
  measureDom?: HTMLElement
  needsUpdate = true
  computedStyle: StyleDeclaration = { ...textDefaultStyle }
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

    this.debug = options.debug ?? false
    this.content = options.content ?? ''
    this.style = options.style ?? {}
    this.measureDom = options.measureDom
    this.effects = options.effects
    this.fonts = options.fonts

    this
      .use(background())
      .use(outline())
      .use(listStyle())
      .use(textDecoration())
      .use(highlight())
      .use(render())

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
    let { content, computedStyle: style } = this
    const paragraphs: Paragraph[] = []
    if (typeof content === 'string') {
      const paragraph = new Paragraph({}, style)
      paragraph.addFragment(content)
      paragraphs.push(paragraph)
    }
    else {
      content = Array.isArray(content) ? content : [content]
      for (const p of content) {
        if (typeof p === 'string') {
          const paragraph = new Paragraph({}, style)
          paragraph.addFragment(p)
          paragraphs.push(paragraph)
        }
        else if (Array.isArray(p)) {
          const paragraph = new Paragraph({}, style)
          p.forEach((f) => {
            if (typeof f === 'string') {
              paragraph.addFragment(f)
            }
            else {
              const { content, ...fStyle } = f
              if (content !== undefined) {
                paragraph.addFragment(content, fStyle)
              }
            }
          })
          paragraphs.push(paragraph)
        }
        else if ('fragments' in p) {
          const { fragments, ...pStyle } = p
          const paragraph = new Paragraph(pStyle, style)
          fragments.forEach((f) => {
            const { content, ...fStyle } = f
            if (content !== undefined) {
              paragraph.addFragment(content, fStyle)
            }
          })
          paragraphs.push(paragraph)
        }
        else if ('content' in p) {
          const { content: pData, ...pStyle } = p
          if (pData !== undefined) {
            const paragraph = new Paragraph(pStyle, style)
            paragraph.addFragment(pData)
            paragraphs.push(paragraph)
          }
        }
      }
    }
    this.paragraphs = paragraphs
    return this
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
        const { inlineBox } = c
        const a = new Vector2(inlineBox.left, inlineBox.top)
        const b = new Vector2(inlineBox.left + inlineBox.width, inlineBox.top + inlineBox.height)
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

  update(): this {
    const result = this.measure()
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
  }
}
