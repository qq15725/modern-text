import type { TextContent } from '../types'
import { Paragraph } from '../content'
import { Feature } from './Feature'

export class Parser extends Feature {
  parse(content: TextContent): Paragraph[] {
    const { style } = this._text
    const paragraphs: Paragraph[] = []
    if (typeof content === 'string') {
      const paragraph = new Paragraph({}, style)
      paragraph.addFragment(content)
      paragraphs.push(paragraph)
    }
    else {
      content = Array.isArray(content) ? content : [content]
      for (const p of content) {
        if (typeof p === 'string') {
          const paragraph = new Paragraph({}, style)
          paragraph.addFragment(p)
          paragraphs.push(paragraph)
        }
        else if (Array.isArray(p)) {
          const paragraph = new Paragraph({}, style)
          p.forEach((f) => {
            if (typeof f === 'string') {
              paragraph.addFragment(f)
            }
            else {
              const { content, highlight, ...fStyle } = f
              if (content !== undefined) {
                const fragment = paragraph.addFragment(content, fStyle)
                fragment.highlight = highlight
              }
            }
          })
          paragraphs.push(paragraph)
        }
        else if ('fragments' in p) {
          const { fragments, ...pStyle } = p
          const paragraph = new Paragraph(pStyle, style)
          fragments.forEach((f) => {
            const { content, highlight, ...fStyle } = f
            if (content !== undefined) {
              const fragment = paragraph.addFragment(content, fStyle)
              fragment.highlight = highlight
            }
          })
          paragraphs.push(paragraph)
        }
        else if ('content' in p) {
          const { content: pData, highlight, ...pStyle } = p
          if (pData !== undefined) {
            const paragraph = new Paragraph(pStyle, style)
            const fragment = paragraph.addFragment(pData)
            fragment.highlight = highlight
            paragraphs.push(paragraph)
          }
        }
      }
    }
    return paragraphs
  }
}
