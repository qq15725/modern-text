import { Paragraph } from './paragraph'
import type { TextContent, TextStyle } from './types'

export function parseParagraphs(content: TextContent, style: TextStyle): Array<Paragraph> {
  const paragraphs: Array<Paragraph> = []
  if (typeof content === 'string') {
    paragraphs.push(new Paragraph({ parent: style }).addFragment({ content }))
  } else {
    content = Array.isArray(content) ? content : [content]
    for (const p of content) {
      if (typeof p === 'string') {
        paragraphs.push(new Paragraph({ parent: style }).addFragment({ content: p }))
      } else if (Array.isArray(p)) {
        const paragraph = new Paragraph({ parent: style })
        p.forEach(f => {
          if (typeof f === 'string') {
            paragraph.addFragment({ content: f })
          } else {
            const { content, ...fStyle } = f
            paragraph.addFragment({ content, style: fStyle })
          }
        })
        paragraphs.push(paragraph)
      } else if ('fragments' in p) {
        const { fragments, ...pStyle } = p
        const paragraph = new Paragraph({ style: pStyle, parent: style })
        fragments.forEach(f => {
          const { content, ...fStyle } = f
          paragraph.addFragment({ content, style: fStyle })
        })
        paragraphs.push(paragraph)
      } else if ('content' in p) {
        const { content: pData, ...pStyle } = p
        paragraphs.push(new Paragraph({ style: pStyle, parent: style }).addFragment({ content: pData }))
      }
    }
  }
  return paragraphs
}
