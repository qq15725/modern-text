import type { IDOCStyleDeclaration } from 'modern-idoc'
import { BoundingBox } from 'modern-path2d'
import { filterEmpty } from '../utils'
import { Fragment } from './Fragment'

export class Paragraph {
  lineBox = new BoundingBox()
  fragments: Fragment[] = []
  declare computedStyle: IDOCStyleDeclaration

  constructor(
    public style: Partial<IDOCStyleDeclaration>,
    public parentStyle: IDOCStyleDeclaration,
  ) {
    this.updateComputedStyle()
  }

  updateComputedStyle(): this {
    this.computedStyle = {
      ...filterEmpty(this.parentStyle),
      ...filterEmpty(this.style),
    } as IDOCStyleDeclaration
    return this
  }

  addFragment(content: string, style?: Partial<IDOCStyleDeclaration>): Fragment {
    const fragment = new Fragment(content, style, this)
    this.fragments.push(fragment)
    return fragment
  }
}
