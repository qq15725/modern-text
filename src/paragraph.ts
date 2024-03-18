import { BoundingBox } from './bounding-box'
import { Fragment } from './fragment'
import type { FragmentOptions } from './fragment'
import type { TextStyle } from './types'

export interface ParagraphOptions {
  style?: Partial<TextStyle>
  parent?: TextStyle
  contentBox?: BoundingBox
  lineBox?: BoundingBox
  glyphBox?: BoundingBox
  baseline?: number
  xHeight?: number
  maxCharWidth?: number
  fragments?: Array<Fragment>
}

export class Paragraph {
  style?: Partial<TextStyle>
  parent?: TextStyle
  contentBox: BoundingBox
  lineBox: BoundingBox
  glyphBox: BoundingBox
  baseline: number
  xHeight: number
  maxCharWidth: number
  fragments: Array<Fragment>

  constructor(
    {
      style,
      parent,
      contentBox = new BoundingBox(),
      lineBox = new BoundingBox(),
      glyphBox = new BoundingBox(),
      baseline = 0,
      xHeight = 0,
      maxCharWidth = 0,
      fragments = [],
    }: ParagraphOptions = {},
  ) {
    this.style = style
    this.parent = parent
    this.contentBox = contentBox
    this.lineBox = lineBox
    this.glyphBox = glyphBox
    this.baseline = baseline
    this.xHeight = xHeight
    this.maxCharWidth = maxCharWidth
    this.fragments = fragments
  }

  addFragment(options: FragmentOptions): this {
    this.fragments.push(new Fragment({ ...options, parent: this }))
    return this
  }

  getComputedStyle(): TextStyle {
    return {
      ...this.parent,
      ...this.style,
    } as TextStyle
  }

  clone(options?: Partial<ParagraphOptions>) {
    return new Paragraph({
      style: this.style,
      parent: this.parent,
      contentBox: this.contentBox.clone(),
      lineBox: this.lineBox.clone(),
      glyphBox: this.glyphBox.clone(),
      baseline: this.baseline,
      xHeight: this.xHeight,
      maxCharWidth: this.maxCharWidth,
      fragments: this.fragments.map(f => f.clone()),
      ...options,
    })
  }
}
