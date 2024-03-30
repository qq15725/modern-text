import { Paragraph } from './paragraph'
import type { TextContent, TextStyle } from './types'

export function parseParagraphs(content: TextContent, style: TextStyle): Array<Paragraph> {
  const paragraphs: Array<Paragraph> = []
  if (typeof content === 'string') {
    paragraphs.push(new Paragraph(undefined, style).addFragment(content))
  } else {
    content = Array.isArray(content) ? content : [content]
    for (const p of content) {
      if (typeof p === 'string') {
        paragraphs.push(new Paragraph(undefined, style).addFragment(p))
      } else if (Array.isArray(p)) {
        const paragraph = new Paragraph(undefined, style)
        p.forEach(f => {
          if (typeof f === 'string') {
            paragraph.addFragment(f)
          } else {
            const { content, ...fStyle } = f
            paragraph.addFragment(content, fStyle)
          }
        })
        paragraphs.push(paragraph)
      } else if ('fragments' in p) {
        const { fragments, ...pStyle } = p
        const paragraph = new Paragraph(pStyle, style)
        fragments.forEach(f => {
          const { content, ...fStyle } = f
          paragraph.addFragment(content, fStyle)
        })
        paragraphs.push(paragraph)
      } else if ('content' in p) {
        const { content: pData, ...pStyle } = p
        paragraphs.push(new Paragraph(pStyle, style).addFragment(pData))
      }
    }
  }
  return paragraphs
}
