import type { Text } from '../Text'
import { uploadColor } from './color'

export function uploadColors(ctx: CanvasRenderingContext2D, text: Text): void {
  const { paragraphs, computedStyle: style, glyphBox } = text
  uploadColor(style, glyphBox, ctx)
  paragraphs.forEach((paragraph) => {
    uploadColor(paragraph.computedStyle, paragraph.lineBox, ctx)
    paragraph.fragments.forEach((fragment) => {
      uploadColor(fragment.computedStyle, fragment.inlineBox, ctx)
    })
  })
}
