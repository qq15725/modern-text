import type { Paragraph } from '../content'
import type { TextStyle } from '../types'
import { BoundingBox } from 'modern-path2d'
import { Character } from '../content'
import { filterEmpty } from '../utils'

export class Fragment {
  boundingBox = new BoundingBox()
  declare characters: Character[]
  declare computedStyle: TextStyle

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
    public style: Partial<TextStyle> = {},
    public parent: Paragraph,
  ) {
    this.updateComputedStyle().initCharacters()
  }

  updateComputedStyle(): this {
    this.computedStyle = {
      ...this.parent.computedStyle,
      ...(filterEmpty(this.style) as Partial<TextStyle>),
    } as TextStyle
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
