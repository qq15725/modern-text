import { Paragraph } from './Paragraph'
import type { TextContent } from './types'
import type { Context } from './Context'

export function paragraphsParse(content: TextContent, context: Context): Array<Paragraph> {
  const paragraphs: Array<Paragraph> = []
  if (typeof content === 'string') {
    paragraphs.push(new Paragraph(undefined, context).addFragment(content))
  } else {
    content = Array.isArray(content) ? content : [content]
    for (const p of content) {
      if (typeof p === 'string') {
        paragraphs.push(new Paragraph(undefined, context).addFragment(p))
      } else if (Array.isArray(p)) {
        const paragraph = new Paragraph(undefined, context)
        p.forEach(f => {
          if (typeof f === 'string') {
            paragraph.addFragment(f)
          } else {
            const { content, ...fStyle } = f
            content !== undefined && paragraph.addFragment(content, fStyle)
          }
        })
        paragraphs.push(paragraph)
      } else if ('fragments' in p) {
        const { fragments, ...pStyle } = p
        const paragraph = new Paragraph(pStyle, context)
        fragments.forEach(f => {
          const { content, ...fStyle } = f
          content !== undefined && paragraph.addFragment(content, fStyle)
        })
        paragraphs.push(paragraph)
      } else if ('content' in p) {
        const { content: pData, ...pStyle } = p
        pData !== undefined && paragraphs.push(new Paragraph(pStyle, context).addFragment(pData))
      }
    }
  }
  return paragraphs
}
