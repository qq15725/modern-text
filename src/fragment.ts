import { BoundingBox } from './bounding-box'
import type { Paragraph } from './paragraph'
import type { TextStyle } from './types'

export interface FragmentOptions {
  content?: string
  style?: Partial<TextStyle>
  parent?: Paragraph
  contentBox?: BoundingBox
  inlineBox?: BoundingBox
  glyphBox?: BoundingBox
  centerX?: number
  baseline?: number
}

export class Fragment {
  content: string
  style?: Partial<TextStyle>
  parent?: Paragraph
  contentBox: BoundingBox
  inlineBox: BoundingBox
  glyphBox: BoundingBox
  centerX: number
  baseline: number

  constructor(
    {
      content = '',
      style,
      parent,
      contentBox = new BoundingBox(),
      inlineBox = new BoundingBox(),
      glyphBox = new BoundingBox(),
      centerX = 0,
      baseline = 0,
    }: FragmentOptions = {},
  ) {
    this.content = content
    this.style = style
    this.parent = parent
    this.contentBox = contentBox
    this.inlineBox = inlineBox
    this.glyphBox = glyphBox
    this.centerX = centerX
    this.baseline = baseline

    switch (this.getComputedStyle().textTransform) {
      case 'uppercase':
        this.content = this.content.toUpperCase()
        break
      case 'lowercase':
        this.content = this.content.toLowerCase()
        break
    }
  }

  getComputedStyle(): TextStyle {
    return {
      ...this.parent?.getComputedStyle(),
      ...this.style,
    } as TextStyle
  }

  clone(options?: Partial<FragmentOptions>): Fragment {
    return new Fragment({
      content: this.content,
      style: this.style,
      parent: this.parent,
      contentBox: this.contentBox.clone(),
      inlineBox: this.inlineBox.clone(),
      glyphBox: this.glyphBox.clone(),
      centerX: this.centerX,
      baseline: this.baseline,
      ...options,
    })
  }
}
