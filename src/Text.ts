import type { Character, Paragraph } from './content'
import type { MeasuredResult } from './features'
import type { TextContent, TextDeformation, TextEffect, TextStyle } from './types'
import { BoundingBox, Point2D } from 'modern-path2d'
import {
  Deformer,
  Effector,
  Highlighter,
  Measurer,
  Parser,
  Renderer2D,
} from './features'

export interface TextRenderOptions {
  view: HTMLCanvasElement
  pixelRatio?: number
}

export interface TextOptions {
  content?: TextContent
  style?: Partial<TextStyle>
  effects?: TextEffect[]
  deformation?: TextDeformation
  measureDom?: HTMLElement
}

export const defaultTextStyles: TextStyle = {
  color: '#000',
  backgroundColor: 'rgba(0, 0, 0, 0)',
  fontSize: 14,
  fontWeight: 'normal',
  fontFamily: '_fallback',
  fontStyle: 'normal',
  fontKerning: 'normal',
  textWrap: 'wrap',
  textAlign: 'start',
  verticalAlign: 'baseline',
  textTransform: 'none',
  textDecoration: 'none',
  textStrokeWidth: 0,
  textStrokeColor: '#000',
  lineHeight: 1,
  letterSpacing: 0,
  shadowColor: 'rgba(0, 0, 0, 0)',
  shadowOffsetX: 0,
  shadowOffsetY: 0,
  shadowBlur: 0,
  writingMode: 'horizontal-tb',
  textOrientation: 'mixed',
}

export class Text {
  content: TextContent
  style: Partial<TextStyle>
  effects?: TextEffect[]
  deformation?: TextDeformation
  measureDom?: HTMLElement

  needsUpdate = true
  computedStyle = { ...defaultTextStyles }
  paragraphs: Paragraph[] = []
  boundingBox = new BoundingBox()
  renderBoundingBox = new BoundingBox()

  protected _parser = new Parser(this)
  protected _measurer = new Measurer(this)
  protected _deformer = new Deformer(this)
  protected _effector = new Effector(this)
  protected _highlighter = new Highlighter(this)
  protected _renderer2D = new Renderer2D(this)

  get characters(): Character[] {
    return this.paragraphs.flatMap(p => p.fragments.flatMap(f => f.characters))
  }

  constructor(options: TextOptions = {}) {
    const { content = '', style = {}, effects, deformation, measureDom } = options
    this.content = content
    this.style = style
    this.effects = effects
    this.deformation = deformation
    this.measureDom = measureDom
  }

  measure(dom = this.measureDom): MeasuredResult {
    this.computedStyle = { ...defaultTextStyles, ...this.style }
    const old = this.paragraphs
    this.paragraphs = this._parser.parse()
    const result = this._measurer.measure(dom)
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
    if (this.deformation) {
      this._deformer.deform()
    }
    this._highlighter.highlight()
    const min = Point2D.MAX
    const max = Point2D.MIN
    characters.forEach(c => c.getMinMax(min, max))
    this.renderBoundingBox = new BoundingBox(min.x, min.y, max.x - min.x, max.y - min.y)
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
    if (this.effects?.length) {
      this.renderBoundingBox = BoundingBox.from(
        this.boundingBox,
        this.renderBoundingBox,
        this._effector.getBoundingBox(),
        this._highlighter.getBoundingBox(),
      )
    }
    else {
      this.renderBoundingBox = BoundingBox.from(
        this.boundingBox,
        this.renderBoundingBox,
        this._highlighter.getBoundingBox(),
      )
    }
    this._renderer2D.setupView({ pixelRatio, ctx })
    this._renderer2D.uploadColors({ ctx })
    this._highlighter.draw({ ctx })
    if (this.effects?.length) {
      this._effector.draw({ ctx })
    }
    else {
      this._renderer2D.draw({ ctx })
    }
    return this
  }
}
