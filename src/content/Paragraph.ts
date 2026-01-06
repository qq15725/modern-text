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
  declare computedFill: NormalizedFill | undefined
  declare computedOutline: NormalizedOutline | undefined

  constructor(
    readonly style: NormalizedStyle,
    readonly index: number,
    readonly parent: Text,
  ) {
    this.update()
  }

  update(): this {
    this.computedStyle = {
      ...filterEmpty(this.parent.computedStyle),
      ...filterEmpty(this.style),
    } as FullStyle

    const fill = this.fill ?? this.parent.computedFill
    this.computedFill = fill ? { ...filterEmpty(fill) } : undefined

    const outline = this.outline ?? this.parent.computedOutline
    this.computedOutline = outline ? { ...filterEmpty(outline) } : undefined

    return this
  }
}
