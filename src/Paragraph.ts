import { BoundingBox } from './BoundingBox'
import { Fragment } from './Fragment'
import { filterEmpty } from './utils'
import type { Context } from './Context'
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
    public context?: Context,
  ) {
    this.update()
  }

  update() {
    this.computedStyle = {
      ...filterEmpty(this.context?.style) as TextStyle,
      ...filterEmpty(this.style) as Partial<TextStyle>,
    } as TextStyle
  }

  addFragment(content: string, style?: Partial<TextStyle>): this {
    this.fragments.push(new Fragment(content, style, this))
    return this
  }

  clone(fragments?: Array<Fragment>) {
    const p = new Paragraph(this.style, this.context)
    p.contentBox = this.contentBox.clone()
    p.lineBox = this.lineBox.clone()
    p.glyphBox = this.glyphBox.clone()
    p.baseline = this.baseline
    p.xHeight = this.xHeight
    p.fragments = fragments ?? this.fragments.map(f => f.clone())
    return p
  }
}
