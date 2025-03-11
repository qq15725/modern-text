import type { StyleDeclaration } from 'modern-idoc'
import { BoundingBox } from 'modern-path2d'
import { filterEmpty } from '../utils'
import { Fragment } from './Fragment'

export class Paragraph {
  lineBox = new BoundingBox()
  fragments: Fragment[] = []
  declare computedStyle: StyleDeclaration

  constructor(
    public style: Partial<StyleDeclaration>,
    public parentStyle: StyleDeclaration,
  ) {
    this.updateComputedStyle()
  }

  updateComputedStyle(): this {
    this.computedStyle = {
      ...filterEmpty(this.parentStyle),
      ...filterEmpty(this.style),
    } as StyleDeclaration
    return this
  }

  addFragment(content: string, style?: Partial<StyleDeclaration>): Fragment {
    const fragment = new Fragment(content, style, this)
    this.fragments.push(fragment)
    return fragment
  }
}
