import { BoundingBox } from './bounding-box'
import { Fragment } from './fragment'
import type { TextStyle } from './types'

export class Paragraph {
  contentBox = new BoundingBox()
  lineBox = new BoundingBox()
  glyphBox = new BoundingBox()
  baseline = 0
  xHeight = 0
  fragments: Array<Fragment> = []
  declare computedStyle: TextStyle

  constructor(
    public style?: Partial<TextStyle>,
    public parent?: TextStyle,
  ) {
    this.update()
  }

  update() {
    this.computedStyle = {
      ...this.parent,
      ...this.style,
    } as TextStyle
  }

  addFragment(content: string, style?: Partial<TextStyle>): this {
    this.fragments.push(new Fragment(content, style, this))
    return this
  }

  clone(fragments?: Array<Fragment>) {
    const p = new Paragraph(this.style, this.parent)
    p.contentBox = this.contentBox.clone()
    p.lineBox = this.lineBox.clone()
    p.glyphBox = this.glyphBox.clone()
    p.baseline = this.baseline
    p.xHeight = this.xHeight
    p.fragments = fragments ?? this.fragments.map(f => f.clone())
    return p
  }
}
