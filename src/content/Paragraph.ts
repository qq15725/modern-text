import type { TextStyle } from '../types'
import { BoundingBox } from 'modern-path2d'
import { filterEmpty } from '../utils'
import { Fragment } from './Fragment'

export class Paragraph {
  boundingBox = new BoundingBox()
  fragments: Fragment[] = []
  declare computedStyle: TextStyle

  constructor(
    public style: Partial<TextStyle>,
    public parentStyle: TextStyle,
  ) {
    this.updateComputedStyle()
  }

  updateComputedStyle(): this {
    this.computedStyle = {
      ...filterEmpty(this.parentStyle),
      ...filterEmpty(this.style),
    } as TextStyle
    return this
  }

  addFragment(content: string, style?: Partial<TextStyle>): Fragment {
    const fragment = new Fragment(content, style, this)
    this.fragments.push(fragment)
    return fragment
  }
}
