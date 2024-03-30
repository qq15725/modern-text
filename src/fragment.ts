import { BoundingBox } from './bounding-box'
import { canvasMeasureText } from './canvas'
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
          c.measure()
          contentWidth = Math.max(contentWidth, c.contentBox.width)
          glyphWidth = Math.max(glyphWidth, c.glyphBox.width)
          height += c.contentBox.height
          if (i !== this.characters.length - 1) height += style.letterSpacing
        })
        this.contentBox.width = contentWidth
        this.contentBox.height = height
        this.glyphBox.width = glyphWidth
        this.glyphBox.height = height
        this.inlineBox.width = style.fontSize * style.lineHeight
        this.inlineBox.height = height
        break
      }
      case 'horizontal-tb': {
        const {
          width,
          height,
          lineHeight,
          glyphAscent,
          glyphWidth,
          glyphHeight,
          baseline,
          centerX,
        } = canvasMeasureText(this.computedContent, style)
        this.inlineBox.width = width
        this.inlineBox.height = lineHeight
        this.contentBox.width = width
        this.contentBox.height = height
        this.glyphBox.width = glyphWidth
        this.glyphBox.height = glyphHeight
        this.baseline = baseline

        // relative
        this.inlineBox.x = 0
        this.inlineBox.y = 0
        this.contentBox.x = 0
        this.contentBox.y = (this.inlineBox.height - this.contentBox.height) / 2
        this.glyphBox.x = 0
        this.glyphBox.y = baseline - glyphAscent
        this.centerX = centerX
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
