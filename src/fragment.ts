import { BoundingBox } from './bounding-box'
import { Character } from './character'
import { filterEmpty } from './utils'
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
      ...filterEmpty(this.style) as Partial<TextStyle>,
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
        const contentBox = { left: 0, right: 0 }
        const glyphBox = { left: 0, right: 0 }
        this.characters.forEach((c, i) => {
          c.update().measure()
          contentBox.left = Math.min(contentBox.left, c.contentBox.left)
          contentBox.right = Math.max(contentBox.right, c.contentBox.right)
          glyphBox.left = Math.min(glyphBox.left, c.glyphBox.left)
          glyphBox.right = Math.max(glyphBox.right, c.glyphBox.right)
          height += c.contentBox.y + c.contentBox.height
          if (i !== this.characters.length - 1) height += style.letterSpacing
        })
        this.inlineBox.width = style.fontSize * style.lineHeight
        this.inlineBox.height = height
        this.contentBox.width = contentBox.right - contentBox.left
        this.contentBox.height = height
        this.glyphBox.width = glyphBox.right - glyphBox.left
        this.glyphBox.height = height
        this.baseline = this.characters[0]?.baseline ?? 0
        this.centerX = height / 2
        this.contentBox.x = contentBox.left
        this.glyphBox.x = glyphBox.left
        break
      }
      case 'horizontal-tb': {
        let width = 0
        const contentBox = { top: 0, bottom: 0 }
        const glyphBox = { top: 0, bottom: 0 }
        this.characters.forEach((c, i) => {
          c.update().measure()
          contentBox.top = Math.min(contentBox.top, c.contentBox.top)
          contentBox.bottom = Math.max(contentBox.bottom, c.contentBox.bottom)
          glyphBox.top = Math.min(glyphBox.top, c.glyphBox.top)
          glyphBox.bottom = Math.max(glyphBox.bottom, c.glyphBox.bottom)
          width += c.contentBox.x + c.contentBox.width
          if (i !== this.characters.length - 1) width += style.letterSpacing
        })
        this.inlineBox.width = width
        this.inlineBox.height = style.fontSize * style.lineHeight
        this.contentBox.width = width
        this.contentBox.height = contentBox.bottom - contentBox.top
        this.glyphBox.width = width
        this.glyphBox.height = glyphBox.bottom - glyphBox.top
        this.centerX = width / 2
        this.inlineBox.x = 0
        this.inlineBox.y = 0
        const first = this.characters[0]
        if (first) {
          this.baseline = first.baseline
          this.contentBox.x = first.contentBox.x
          this.glyphBox.x = first.glyphBox.x
        }
        this.contentBox.y = contentBox.top
        this.glyphBox.y = glyphBox.top
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
