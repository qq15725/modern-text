import type { FullStyle, NormalizedFill, NormalizedOutline, NormalizedStyle } from 'modern-idoc'
import type { Paragraph } from '../content'
import { BoundingBox } from 'modern-path2d'
import { Character } from '../content'
import { filterEmpty } from '../utils'

export class Fragment {
  inlineBox = new BoundingBox()

  declare characters: Character[]
  declare computedStyle: FullStyle
  declare computedFill: NormalizedFill | undefined
  declare computedOutline: NormalizedOutline | undefined

  get computedContent(): string {
    const style = this.computedStyle
    return style.textTransform === 'uppercase'
      ? this.content.toUpperCase()
      : style.textTransform === 'lowercase'
        ? this.content.toLowerCase()
        : this.content
  }

  constructor(
    readonly content: string,
    readonly style: NormalizedStyle = {},
    readonly fill: NormalizedFill | undefined,
    readonly outline: NormalizedOutline | undefined,
    readonly index: number,
    readonly parent: Paragraph,
  ) {
    this.update().initCharacters()
  }

  update(): this {
    this.computedStyle = {
      ...this.parent.computedStyle,
      ...(filterEmpty(this.style) as NormalizedStyle),
    } as FullStyle

    const fill = this.fill ?? this.parent.computedFill
    this.computedFill = fill ? { ...filterEmpty(fill) } : undefined

    const outline = this.outline ?? this.parent.computedOutline
    this.computedOutline = outline ? { ...filterEmpty(outline) } : undefined

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
