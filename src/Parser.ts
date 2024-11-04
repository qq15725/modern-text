import type { Text } from './Text'
import { Paragraph } from './content'

export class Parser {
  constructor(
    protected _text: Text,
  ) {
    //
  }

  parse(): Paragraph[] {
    let { content, computedStyle: style } = this._text
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
              const { content, ...fStyle } = f
              if (content !== undefined) {
                paragraph.addFragment(content, fStyle)
              }
            }
          })
          paragraphs.push(paragraph)
        }
        else if ('fragments' in p) {
          const { fragments, ...pStyle } = p
          const paragraph = new Paragraph(pStyle, style)
          fragments.forEach((f) => {
            const { content, ...fStyle } = f
            if (content !== undefined) {
              paragraph.addFragment(content, fStyle)
            }
          })
          paragraphs.push(paragraph)
        }
        else if ('content' in p) {
          const { content: pData, ...pStyle } = p
          if (pData !== undefined) {
            const paragraph = new Paragraph(pStyle, style)
            paragraph.addFragment(pData)
            paragraphs.push(paragraph)
          }
        }
      }
    }
    return paragraphs
  }
}
