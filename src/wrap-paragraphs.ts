import { canvasMeasureText } from './canvas'
import type { Fragment } from './fragment'
import type { Paragraph } from './paragraph'

// eslint-disable-next-line no-misleading-character-class
const punctuationRE = /[\s\n\t\u200B\u200C\u200D\u200E\u200F.,?!:;"'(){}\[\]<>\/\\|~#\$%\*\+=&^，。？！：；“”‘’（）【】《》……——]/

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
      const fStyle = f.getComputedStyle()
      let content = ''
      let wrap = false
      let index = 0
      let word = ''
      for (const c of f.content) {
        p.maxCharWidth = Math.max(
          p.maxCharWidth,
          canvasMeasureText(c, { ...fStyle, letterSpacing: 0 }).width,
        )
        word += c
        if (punctuationRE.test(f.content[++index])) continue
        let size
        let cSize
        switch (fStyle.writingMode) {
          case 'vertical-lr':
          case 'vertical-rl':
            size = height
            cSize = word.length * fStyle.fontSize
            break
          case 'horizontal-tb':
          default:
            size = width
            cSize = canvasMeasureText(word, { ...fStyle, letterSpacing: 0 }).width
            break
        }
        cSize += word.length * fStyle.letterSpacing
        const isNewline = /^[\r\n]$/.test(word)
        if (
          isNewline
          || (
            fStyle.textWrap === 'wrap'
            && size && pSize + cSize > size
          )
        ) {
          let pos = isNewline ? content.length + 1 : content.length
          if (!pSize && !pos) {
            content += word
            pos += word.length
          }
          if (content.length) fragments.push(f.clone({ content }))
          if (fragments.length) {
            newParagraphs.push(
              p.clone({
                fragments: fragments.slice(),
              }),
            )
            fragments.length = 0
          }
          const restContent = f.content.substring(pos)
          if (restContent.length || restFragments.length) {
            restParagraphs.unshift(
              p.clone({
                maxCharWidth: 0,
                fragments: (
                  restContent.length
                    ? [f.clone({ content: restContent })]
                    : []
                ).concat(restFragments.slice()),
              }),
            )
          }
          restFragments.length = 0
          wrap = true
          break
        } else {
          pSize += cSize
        }
        content += word
        word = ''
      }
      if (!wrap) fragments.push(f.clone())
    }
    if (fragments.length) {
      newParagraphs.push(p.clone({ fragments }))
    }
  }
  return newParagraphs
}
