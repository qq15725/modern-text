import type { ITextStyle } from 'modern-idoc'
import { BoundingBox } from 'modern-path2d'
import { filterEmpty } from '../utils'
import { Fragment } from './Fragment'

export class Paragraph {
  lineBox = new BoundingBox()
  fragments: Fragment[] = []
  declare computedStyle: ITextStyle

  constructor(
    public style: Partial<ITextStyle>,
    public parentStyle: ITextStyle,
  ) {
    this.updateComputedStyle()
  }

  updateComputedStyle(): this {
    this.computedStyle = {
      ...filterEmpty(this.parentStyle),
      ...filterEmpty(this.style),
    } as ITextStyle
    return this
  }

  addFragment(content: string, style?: Partial<ITextStyle>): Fragment {
    const fragment = new Fragment(content, style, this)
    this.fragments.push(fragment)
    return fragment
  }
}
