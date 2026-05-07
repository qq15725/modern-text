import type { FullStyle, NormalizedFill, NormalizedOutline, NormalizedStyle } from 'modern-idoc'
import type { Text } from '../Text'
import type { Fragment } from './Fragment'
import { clearUndef } from 'modern-idoc'
import { BoundingBox } from 'modern-path2d'

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
      ...clearUndef(this.parent.computedStyle),
      ...clearUndef(this.style),
    } as FullStyle

    const fill = this.fill ?? this.parent.computedFill
    this.computedFill = fill ? clearUndef(fill) as NormalizedFill : undefined

    const outline = this.outline ?? this.parent.computedOutline
    this.computedOutline = outline ? clearUndef(outline) as NormalizedOutline : undefined

    return this
  }
}
