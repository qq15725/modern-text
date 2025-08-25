import type { FullStyle, NormalizedFill, NormalizedOutline, NormalizedStyle } from 'modern-idoc'
import type { Text } from '../Text'
import type { Fragment } from './Fragment'
import { BoundingBox } from 'modern-path2d'
import { filterEmpty } from '../utils'

export class Paragraph {
  lineBox = new BoundingBox()
  fragments: Fragment[] = []
  fill?: NormalizedFill
  outline?: NormalizedOutline

  declare computedStyle: FullStyle

  get computedFill(): NormalizedFill | undefined {
    return this.fill ?? this.parent.fill
  }

  get computedOutline(): NormalizedOutline | undefined {
    return this.outline ?? this.parent.outline
  }

  constructor(
    public style: NormalizedStyle,
    public index: number,
    public parent: Text,
  ) {
    this.updateComputedStyle()
  }

  updateComputedStyle(): this {
    this.computedStyle = {
      ...filterEmpty(this.parent.computedStyle),
      ...filterEmpty(this.style),
    } as FullStyle
    return this
  }
}
