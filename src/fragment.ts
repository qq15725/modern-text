import { BoundingBox } from './bounding-box'
import { Character } from './character'
import type { Paragraph } from './paragraph'
import type { TextStyle } from './types'

export class Fragment {
  contentBox = new BoundingBox()
  inlineBox = new BoundingBox()
  glyphBox = new BoundingBox()
  centerX = 0
  baseline = 0
  declare characters: Array<Character>
  declare computedStyle: TextStyle
  declare computedContent: string

  constructor(
    public content: string,
    public style?: Partial<TextStyle>,
    public parent?: Paragraph,
  ) {
    this.update()
  }

  update(): this {
    this.computedStyle = {
      ...this.parent?.computedStyle,
      ...this.style,
    } as TextStyle

    const style = this.computedStyle
    this.computedContent = style.textTransform === 'uppercase'
      ? this.content.toUpperCase()
      : style.textTransform === 'lowercase'
        ? this.content.toLowerCase()
        : this.content

    const characters = []
    for (const c of this.computedContent) {
      characters.push(new Character(c, this))
    }
    this.characters = characters

    return this
  }

  measure(): this {
    const style = this.computedStyle

    switch (style.writingMode) {
      case 'vertical-lr':
      case 'vertical-rl': {
        let height = 0
        let contentWidth = 0
        let glyphWidth = 0
        this.characters.forEach((c, i) => {
          c.update().measure()
          contentWidth = Math.max(contentWidth, c.contentBox.width)
          glyphWidth = Math.max(glyphWidth, c.glyphBox.width)
          height += c.contentBox.y + c.contentBox.height
          if (i !== this.characters.length - 1) height += style.letterSpacing
        })
        this.inlineBox.width = style.fontSize * style.lineHeight
        this.inlineBox.height = height
        this.contentBox.width = contentWidth
        this.contentBox.height = height
        this.glyphBox.width = glyphWidth
        this.glyphBox.height = height
        this.baseline = this.characters[0]?.baseline ?? 0
        this.centerX = height / 2
        break
      }
      case 'horizontal-tb': {
        let width = 0
        let contentHeight = 0
        let glyphHeight = 0
        this.characters.forEach((c, i) => {
          c.update().measure()
          contentHeight = Math.max(contentHeight, c.contentBox.height)
          glyphHeight = Math.max(glyphHeight, c.glyphBox.height)
          width += c.contentBox.x + c.contentBox.width
          if (i !== this.characters.length - 1) width += style.letterSpacing
        })

        this.inlineBox.width = width
        this.inlineBox.height = style.fontSize * style.lineHeight
        this.contentBox.width = width
        this.contentBox.height = contentHeight
        this.glyphBox.width = width
        this.glyphBox.height = glyphHeight
        this.centerX = width / 2
        this.inlineBox.x = 0
        this.inlineBox.y = 0
        const first = this.characters[0]
        if (first) {
          this.baseline = first.baseline
          this.contentBox.x = first.contentBox.x
          this.glyphBox.x = first.glyphBox.x
        }
        this.contentBox.y = (this.inlineBox.height - this.contentBox.height) / 2
        this.glyphBox.y = (this.inlineBox.height - this.glyphBox.height) / 2
        break
      }
    }

    return this
  }

  clone(content?: string): Fragment {
    return new Fragment(
      content ?? this.content,
      this.style,
      this.parent,
    )
  }
}
