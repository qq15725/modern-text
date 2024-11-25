import type { Paragraph } from './content'
import type { Text } from './Text'
import type { TextStyle } from './types'
import { BoundingBox } from 'modern-path2d'

export interface MeasuredParagraph {
  paragraphIndex: number
  left: number
  top: number
  width: number
  height: number
}

export interface MeasuredFragment {
  paragraphIndex: number
  fragmentIndex: number
  left: number
  top: number
  width: number
  height: number
}

export interface MeasuredCharacter {
  paragraphIndex: number
  fragmentIndex: number
  characterIndex: number
  newParagraphIndex: number
  content: string
  left: number
  top: number
  width: number
  height: number
  textHeight: number
  textWidth: number
}

export interface MeasureDomResult {
  paragraphs: Paragraph[]
  boundingBox: BoundingBox
}

export class Measurer {
  constructor(
    protected _text: Text,
  ) {
    //
  }

  protected _styleToDomStyle(style: Partial<TextStyle>): Record<string, any> {
    const _style: Record<string, any> = { ...style }
    for (const key in style) {
      if (
        [
          'width',
          'height',
          'fontSize',
          'letterSpacing',
          'textStrokeWidth',
          'textIndent',
          'shadowOffsetX',
          'shadowOffsetY',
          'shadowBlur',
        ].includes(key)
      ) {
        _style[key] = `${(style as any)[key]}px`
      }
      else {
        _style[key] = (style as any)[key]
      }
    }
    return _style
  }

  /**
   * <section style="...">
   *   <ul>
   *     <li style="...">
   *       <span style="...">...</span>
   *       <span>...</span>
   *     </li>
   *   </ul>
   * </section>
   */
  createDom(): { dom: HTMLElement, destory: () => void } {
    const { paragraphs, computedStyle } = this._text
    const documentFragment = document.createDocumentFragment()
    const dom = document.createElement('section')
    Object.assign(dom.style, {
      width: 'max-content',
      height: 'max-content',
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-all',
      ...this._styleToDomStyle(computedStyle),
      position: 'fixed',
      visibility: 'hidden',
    })
    const ul = document.createElement('ul')
    Object.assign(ul.style, {
      listStyleType: 'inherit',
      padding: '0',
      margin: '0',
    })
    paragraphs.forEach((paragraph) => {
      const li = document.createElement('li')
      Object.assign(li.style, this._styleToDomStyle(paragraph.style))
      paragraph.fragments.forEach((fragment) => {
        const span = document.createElement('span')
        Object.assign(span.style, this._styleToDomStyle(fragment.style))
        span.appendChild(document.createTextNode(fragment.content))
        li.appendChild(span)
      })
      ul.appendChild(li)
    })
    dom.appendChild(ul)
    documentFragment.appendChild(dom)
    document.body.appendChild(documentFragment)
    return {
      dom,
      destory: () => dom.parentNode?.removeChild(dom),
    }
  }

  protected _measureDom(dom: HTMLElement): { paragraphs: MeasuredParagraph[], fragments: MeasuredFragment[], characters: MeasuredCharacter[] } {
    const paragraphs: MeasuredParagraph[] = []
    const fragments: MeasuredFragment[] = []
    const characters: MeasuredCharacter[] = []
    dom.querySelectorAll('li').forEach((li, paragraphIndex) => {
      const pBox = li.getBoundingClientRect()
      paragraphs.push({
        paragraphIndex,
        left: pBox.left,
        top: pBox.top,
        width: pBox.width,
        height: pBox.height,
      })
      li.querySelectorAll('span').forEach((span, fragmentIndex) => {
        const fBox = span.getBoundingClientRect()
        fragments.push({
          paragraphIndex,
          fragmentIndex,
          left: fBox.left,
          top: fBox.top,
          width: fBox.width,
          height: fBox.height,
        })
        const text = span.firstChild
        if (text instanceof window.Text) {
          const range = document.createRange()
          range.selectNodeContents(text)
          const data = text.data ?? ''
          Array.from(data).forEach((char, index) => {
            const start = data.indexOf(char)
            const end = start + char.length
            range.setStart(text, Math.max(start, 0))
            range.setEnd(text, end)
            const rects = range.getClientRects?.() ?? [range.getBoundingClientRect()]
            let rect = rects[rects.length - 1]
            if (rects.length > 1 && rect.width < 2) {
              rect = rects[rects.length - 2]
            }
            const content = range.toString()
            if (content !== '' && rect && rect.width + rect.height !== 0) {
              characters.push({
                content,
                newParagraphIndex: -1,
                paragraphIndex,
                fragmentIndex,
                characterIndex: index,
                top: rect.top,
                left: rect.left,
                height: rect.height,
                width: rect.width,
                textWidth: -1,
                textHeight: -1,
              })
            }
          })
        }
      })
    })
    return {
      paragraphs,
      fragments,
      characters,
    }
  }

  measureDom(dom: HTMLElement): MeasureDomResult {
    const { paragraphs } = this._text
    const rect = dom.getBoundingClientRect()
    const measured = this._measureDom(dom)
    measured.paragraphs.forEach((p) => {
      const _p = paragraphs[p.paragraphIndex]
      _p.lineBox.left = p.left - rect.left
      _p.lineBox.top = p.top - rect.top
      _p.lineBox.width = p.width
      _p.lineBox.height = p.height
    })
    measured.fragments.forEach((f) => {
      const _f = paragraphs[f.paragraphIndex].fragments[f.fragmentIndex]
      _f.inlineBox.left = f.left - rect.left
      _f.inlineBox.top = f.top - rect.top
      _f.inlineBox.width = f.width
      _f.inlineBox.height = f.height
    })
    const results: MeasuredCharacter[] = []
    let i = 0
    measured.characters.forEach((character) => {
      const { paragraphIndex, fragmentIndex, characterIndex } = character
      results.push({
        ...character,
        newParagraphIndex: paragraphIndex,
        left: character.left - rect.left,
        top: character.top - rect.top,
      })
      const item = paragraphs[paragraphIndex].fragments[fragmentIndex].characters[characterIndex]
      const { fontHeight, isVertical } = item
      const result = results[i]
      // inlineBox
      item.inlineBox.left = result.left
      item.inlineBox.top = result.top
      item.inlineBox.width = result.width
      item.inlineBox.height = result.height
      // lineBox
      if (isVertical) {
        item.lineBox.left = result.left + (result.width - fontHeight) / 2
        item.lineBox.top = result.top
        item.lineBox.width = fontHeight
        item.lineBox.height = result.height
      }
      else {
        item.lineBox.left = result.left
        item.lineBox.top = result.top + (result.height - fontHeight) / 2
        item.lineBox.width = result.width
        item.lineBox.height = fontHeight
      }

      i++
    })
    return {
      paragraphs,
      boundingBox: new BoundingBox(0, 0, rect.width, rect.height),
    }
  }

  measure(dom?: HTMLElement): MeasureDomResult {
    let destory: undefined | (() => void)
    if (!dom) {
      ({ dom, destory } = this.createDom())
    }
    const result = this.measureDom(dom)
    destory?.()
    return result
  }
}
