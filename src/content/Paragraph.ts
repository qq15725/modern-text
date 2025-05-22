import type { NormalizedStyle } from 'modern-idoc'
import { BoundingBox } from 'modern-path2d'
import { filterEmpty } from '../utils'
import { Fragment } from './Fragment'

export class Paragraph {
  lineBox = new BoundingBox()
  fragments: Fragment[] = []
  declare computedStyle: NormalizedStyle

  constructor(
    public style: Partial<NormalizedStyle>,
    public parentStyle: NormalizedStyle,
  ) {
    this.updateComputedStyle()
  }

  updateComputedStyle(): this {
    this.computedStyle = {
      ...filterEmpty(this.parentStyle),
      ...filterEmpty(this.style),
    } as NormalizedStyle
    return this
  }

  addFragment(content: string, style?: Partial<NormalizedStyle>): Fragment {
    const fragment = new Fragment(content, style, this)
    this.fragments.push(fragment)
    return fragment
  }
}
