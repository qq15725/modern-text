import type { Character, Paragraph } from './content'
import type { MeasureDomResult } from './Measurer'
import type { Plugin } from './Plugin'
import type { TextContent, TextStyle } from './types'
import { BoundingBox, getPathsBoundingBox, Vector2 } from 'modern-path2d'
import { drawPath, setupView, uploadColors } from './canvas'
import { Measurer } from './Measurer'
import { Parser } from './Parser'
import { highlight, listStyle, render } from './plugins'

export interface TextRenderOptions {
  view: HTMLCanvasElement
  pixelRatio?: number
}

export interface TextOptions {
  content?: TextContent
  style?: Partial<TextStyle>
  measureDom?: HTMLElement
  effects?: Partial<TextStyle>[]
}

export type MeasureResult = MeasureDomResult & {
  glyphBox: BoundingBox
}

export const defaultTextStyles: TextStyle = {
  writingMode: 'horizontal-tb',
  verticalAlign: 'baseline',
  lineHeight: 1.2,
  letterSpacing: 0,
  // font
  fontSize: 14,
  fontWeight: 'normal',
  fontFamily: '_fallback',
  fontStyle: 'normal',
  fontKerning: 'normal',
  // text
  textWrap: 'wrap',
  textAlign: 'start',
  textIndent: 0,
  textTransform: 'none',
  textOrientation: 'mixed',
  textDecoration: 'none',
  // textStroke
  textStrokeWidth: 0,
  textStrokeColor: '#000',
  // color
  color: '#000',
  backgroundColor: 'rgba(0, 0, 0, 0)',
  // listStyle
  listStyleType: 'none',
  listStyleImage: 'none',
  listStyleSize: 'cover',
  listStylePosition: 'outside',
  // highlight
  highlightReferImage: 'none',
  highlightImage: 'none',
  highlightSize: 'cover',
  highlightStrokeWidth: '100%',
  highlightOverflow: 'none',
  // shadow
  shadowColor: 'rgba(0, 0, 0, 0)',
  shadowOffsetX: 0,
  shadowOffsetY: 0,
  shadowBlur: 0,
  translateX: 0,
  translateY: 0,
  skewX: 0,
  skewY: 0,
}

export class Text {
  content: TextContent
  style: Partial<TextStyle>
  effects?: Partial<TextStyle>[]
  measureDom?: HTMLElement
  needsUpdate = true
  computedStyle: TextStyle = { ...defaultTextStyles }
  paragraphs: Paragraph[] = []
  boundingBox = new BoundingBox()
  glyphBox = new BoundingBox()
  parser = new Parser(this)
  measurer = new Measurer(this)
  plugins = new Map<string, Plugin>()

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
    const { content = '', style = {}, measureDom, effects } = options
    this.content = content
    this.style = style
    this.measureDom = measureDom
    this.effects = effects

    this
      .use(render())
      .use(highlight())
      .use(listStyle())
  }

  use(plugin: Plugin): this {
    this.plugins.set(plugin.name, plugin)
    return this
  }

  measure(dom = this.measureDom): MeasureResult {
    this.computedStyle = { ...defaultTextStyles, ...this.style }
    const old = {
      paragraphs: this.paragraphs,
      boundingBox: this.boundingBox,
      glyphBox: this.glyphBox,
    }
    this.paragraphs = this.parser.parse()
    const result = this.measurer.measure(dom) as MeasureResult
    this.paragraphs = result.paragraphs
    this.boundingBox = result.boundingBox
    const characters = this.characters
    characters.forEach(c => c.update())
    const plugins = [...this.plugins.values()]
    plugins
      .sort((a, b) => (a.updateOrder ?? 0) - (b.updateOrder ?? 0))
      .forEach((plugin) => {
        plugin.update?.(this)
      })
    const min = Vector2.MAX
    const max = Vector2.MIN
    characters.forEach((c) => {
      if (!c.getGlyphMinMax(min, max)) {
        const { inlineBox } = c
        const a = new Vector2(inlineBox.left, inlineBox.top)
        const b = new Vector2(inlineBox.left + inlineBox.width, inlineBox.top + inlineBox.height)
        min.min(a, b)
        max.max(a, b)
      }
    })
    this.glyphBox = new BoundingBox(min.x, min.y, max.x - min.x, max.y - min.y)
    const dLeft = this.glyphBox.left - result.boundingBox.left
    const dRight = result.boundingBox.right - this.glyphBox.right
    const dTop = this.glyphBox.top - result.boundingBox.top
    const dBottom = result.boundingBox.bottom - this.glyphBox.bottom
    this.glyphBox = BoundingBox.from(
      this.glyphBox,
      ...plugins
        .map((plugin) => {
          if (plugin.getBoundingBox) {
            return plugin.getBoundingBox(this)
          }
          return getPathsBoundingBox(plugin.paths ?? [])
        })
        .filter(Boolean) as BoundingBox[],
    )
    result.glyphBox = this.glyphBox
    result.boundingBox.width = this.glyphBox.width + dLeft + dRight
    result.boundingBox.height = this.glyphBox.height + dTop + dBottom
    this.paragraphs = old.paragraphs
    this.boundingBox = old.boundingBox
    this.glyphBox = old.glyphBox
    return result
  }

  requestUpdate(): this {
    this.needsUpdate = true
    return this
  }

  update(): this {
    const { paragraphs, boundingBox, glyphBox } = this.measure()
    this.paragraphs = paragraphs
    this.boundingBox = boundingBox
    this.glyphBox = glyphBox
    return this
  }

  render(options: TextRenderOptions): this {
    const { view, pixelRatio = 2 } = options
    const ctx = view.getContext('2d')
    if (!ctx) {
      return this
    }
    if (this.needsUpdate) {
      this.update()
    }
    setupView(ctx, pixelRatio, this.boundingBox)
    uploadColors(ctx, this)
    const plugins = [...this.plugins.values()]
    plugins
      .sort((a, b) => (a.renderOrder ?? 0) - (b.renderOrder ?? 0))
      .forEach((plugin) => {
        if (plugin.render) {
          plugin.render?.(ctx, this)
        }
        else if (plugin.paths) {
          plugin.paths.forEach((path) => {
            drawPath({
              ctx,
              path,
              fontSize: this.computedStyle.fontSize,
            })
          })
        }
      })
    return this
  }
}
