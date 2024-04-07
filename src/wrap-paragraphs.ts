import { Fragment } from './fragment'
import type { Paragraph } from './paragraph'

export function wrapParagraphs(
  paragraphs: Array<Paragraph>,
  width?: number,
  height?: number,
): Array<Paragraph> {
  const newParagraphs: Array<Paragraph> = []
  const restParagraphs = paragraphs.slice()
  let p: Paragraph | undefined
  let f: Fragment | undefined
  // eslint-disable-next-line no-cond-assign
  while (p = restParagraphs.shift()) {
    const restFragments = p.fragments.slice()
    let pSize = 0
    const fragments = []
    // eslint-disable-next-line no-cond-assign
    while (f = restFragments.shift()) {
      const style = f.computedStyle
      let content = ''
      let wrap = false
      let index = 0
      const tempF = new Fragment('', f.style, f.parent)
      for (const c of f.characters) {
        tempF.content += c.content
        if (f.characters[++index]?.isPunctuation) continue
        let size
        let cSize
        switch (style.writingMode) {
          case 'vertical-lr':
          case 'vertical-rl':
            size = height
            cSize = tempF.update().measure().contentBox.height
            break
          case 'horizontal-tb':
          default:
            size = width
            cSize = tempF.update().measure().contentBox.width
            break
        }
        cSize += style.letterSpacing
        if (
          c.isEOL
          || (size && pSize + cSize > size)
        ) {
          let pos = c.isEOL ? content.length + 1 : content.length
          if (!pSize && !pos) {
            content += tempF.computedContent
            pos += tempF.computedContent.length
          }
          if (content.length) {
            fragments.push(f.clone(content))
          }
          if (fragments.length) {
            newParagraphs.push(p.clone(fragments.slice()))
            fragments.length = 0
          }
          const restContent = f.computedContent.substring(pos)
          if (restContent.length || restFragments.length) {
            restParagraphs.unshift(
              p.clone(
                (
                  restContent.length
                    ? [f.clone(restContent)]
                    : []
                ).concat(restFragments.slice()),
              ),
            )
          }
          restFragments.length = 0
          wrap = true
          break
        } else {
          pSize += cSize
        }
        content += tempF.computedContent
        tempF.content = ''
      }
      if (!wrap) {
        fragments.push(f.clone())
      }
    }
    if (fragments.length) {
      newParagraphs.push(p.clone(fragments))
    }
  }
  return newParagraphs
}
