import type { Text } from '../Text'

export function fillBackground(ctx: CanvasRenderingContext2D, text: Text): void {
  const { computedStyle: style, paragraphs } = text
  function fillBackground(color: any, x: number, y: number, width: number, height: number): void {
    ctx.fillStyle = color
    ctx.fillRect(x, y, width, height)
  }
  if (style?.backgroundColor) {
    fillBackground(style.backgroundColor, 0, 0, ctx.canvas.width, ctx.canvas.height)
  }
  paragraphs.forEach((paragraph) => {
    if (paragraph.style?.backgroundColor) {
      fillBackground(paragraph.computedStyle.backgroundColor, ...paragraph.boundingBox.toArray())
    }
    paragraph.fragments.forEach((fragment) => {
      if (fragment.style?.backgroundColor) {
        fillBackground(fragment.computedStyle.backgroundColor, ...fragment.boundingBox.toArray())
      }
    })
  })
}
