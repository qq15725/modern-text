import type { Character, Paragraph } from './content'
import type { MeasuredResult } from './Measurer'
import type { Plugin } from './Plugin'
import type { HighlightOptions, TextEffect } from './plugins'
import type { TextContent, TextStyle } from './types'
import { BoundingBox, getPathsBoundingBox, Vector2 } from 'modern-path2d'
import { drawPath, setupView, uploadColors } from './canvas'
import { Measurer } from './Measurer'
import { Parser } from './Parser'
import { effect, highlight, listStyle } from './plugins'

export interface TextRenderOptions {
  view: HTMLCanvasElement
  pixelRatio?: number
}

export interface TextOptions {
  content?: TextContent
  style?: Partial<TextStyle>
  measureDom?: HTMLElement
  effects?: TextEffect[]
  highlight?: HighlightOptions
}

export const defaultTextStyles: TextStyle = {
  writingMode: 'horizontal-tb',
  verticalAlign: 'baseline',
  lineHeight: 1,
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
  textTransform: 'none',
  textOrientation: 'mixed',
  // color
  color: '#000',
  backgroundColor: 'rgba(0, 0, 0, 0)',
  // text
  textDecoration: 'none',
  // textStroke
  textStrokeWidth: 0,
  textStrokeColor: '#000',
  // shadow
  shadowColor: 'rgba(0, 0, 0, 0)',
  shadowOffsetX: 0,
  shadowOffsetY: 0,
  shadowBlur: 0,
  // listStyle
  listStyleType: 'none',
  listStyleImage: 'none',
  listStyleSize: 'cover',
  listStylePosition: 'outside',
  // highlight
  highlightImage: 'none',
  highlightSize: 'cover',
  highlightStrokeWidth: '100%',
  highlightOverflow: 'none',
}

export class Text {
  content: TextContent
  style: Partial<TextStyle>
  measureDom?: HTMLElement
  needsUpdate = true
  computedStyle = { ...defaultTextStyles }
  paragraphs: Paragraph[] = []
  boundingBox = new BoundingBox()
  renderBoundingBox = new BoundingBox()
  parser = new Parser(this)
  measurer = new Measurer(this)
  plugins = new Map<string, Plugin>()

  get fontSize(): number {
    return this.computedStyle.fontSize
  }

  get characters(): Character[] {
    return this.paragraphs.flatMap(p => p.fragments.flatMap(f => f.characters))
  }

  constructor(options: TextOptions = {}) {
    const { content = '', style = {}, measureDom } = options
    this.content = content
    this.style = style
    this.measureDom = measureDom

    this
      .use(effect(options.effects))
      .use(highlight(options.highlight))
      .use(listStyle())
  }

  use(plugin: Plugin): this {
    this.plugins.set(plugin.name, plugin)
    return this
  }

  measure(dom = this.measureDom): MeasuredResult {
    this.computedStyle = { ...defaultTextStyles, ...this.style }
    const old = this.paragraphs
    this.paragraphs = this.parser.parse()
    const result = this.measurer.measure(dom)
    this.paragraphs = old
    return result
  }

  requestUpdate(): this {
    this.needsUpdate = true
    return this
  }

  update(): this {
    const { paragraphs, boundingBox } = this.measure()
    this.paragraphs = paragraphs
    this.boundingBox = boundingBox
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
    characters.forEach(c => c.getGlyphMinMax(min, max))
    this.renderBoundingBox = new BoundingBox(min.x, min.y, max.x - min.x, max.y - min.y)
    this.renderBoundingBox = BoundingBox.from(
      this.renderBoundingBox,
      ...plugins
        .map((plugin) => {
          if (plugin.getBoundingBox) {
            return plugin.getBoundingBox(this)
          }
          return getPathsBoundingBox(plugin.paths ?? [])
        })
        .filter(Boolean) as BoundingBox[],
    )
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
    setupView(ctx, pixelRatio, this.renderBoundingBox)
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
