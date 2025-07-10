import type { FullStyle, NormalizedFill, NormalizedOutline, NormalizedStyle } from 'modern-idoc'
import type { Paragraph } from '../content'
import { BoundingBox } from 'modern-path2d'
import { Character } from '../content'
import { filterEmpty } from '../utils'

export class Fragment {
  inlineBox = new BoundingBox()
  fill?: NormalizedFill
  outline?: NormalizedOutline
  declare characters: Character[]
  declare computedStyle: FullStyle

  get computedFill(): NormalizedFill | undefined {
    return this.fill ?? this.parent.computedFill
  }

  get computedOutline(): NormalizedOutline | undefined {
    return this.outline ?? this.parent.computedOutline
  }

  get computedContent(): string {
    const style = this.computedStyle
    return style.textTransform === 'uppercase'
      ? this.content.toUpperCase()
      : style.textTransform === 'lowercase'
        ? this.content.toLowerCase()
        : this.content
  }

  constructor(
    public content: string,
    public style: NormalizedStyle = {},
    public parent: Paragraph,
  ) {
    this.updateComputedStyle().initCharacters()
  }

  updateComputedStyle(): this {
    this.computedStyle = {
      ...this.parent.computedStyle,
      ...(filterEmpty(this.style) as NormalizedStyle),
    } as FullStyle
    return this
  }

  initCharacters(): this {
    const characters = []
    let index = 0
    for (const c of this.computedContent) {
      characters.push(new Character(c, index++, this))
    }
    this.characters = characters
    return this
  }
}
