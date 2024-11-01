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

export interface MeasuredResult {
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
      ...this._styleToDomStyle(computedStyle),
      position: 'absolute',
      visibility: 'hidden',
    })
    const ul = document.createElement('ul')
    Object.assign(ul.style, {
      listStyle: 'none',
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
        const fBox = li.getBoundingClientRect()
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
          const len = text.data ? text.data.length : 0
          let i = 0
          for (; i <= len;) {
            range.setStart(text, Math.max(i - 1, 0))
            range.setEnd(text, i)
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
                characterIndex: i - 1,
                top: rect.top,
                left: rect.left,
                height: rect.height,
                width: rect.width,
                textWidth: -1,
                textHeight: -1,
              })
            }
            i++
          }
        }
      })
    })
    return {
      paragraphs,
      fragments,
      characters,
    }
  }

  measureDom(dom: HTMLElement): MeasuredResult {
    const { paragraphs } = this._text
    const rect = dom.getBoundingClientRect()
    const innerEl = dom.querySelector('ul')!
    const isVertical = window.getComputedStyle(dom).writingMode.includes('vertical')
    const oldLineHeight = innerEl.style.lineHeight
    innerEl.style.lineHeight = '4000px'
    const _paragraphs: MeasuredCharacter[][] = [[]]
    let fragments = _paragraphs[0]
    const { characters: oldCharacters } = this._measureDom(dom)
    if (oldCharacters.length > 0) {
      fragments.push(oldCharacters[0])
      oldCharacters.reduce((prev, current) => {
        const attr = isVertical ? 'left' : 'top'
        if (Math.abs(current[attr] - prev[attr]) > 4000 / 2) {
          fragments = []
          _paragraphs.push(fragments)
        }
        fragments.push(current)
        return current
      })
    }
    innerEl.style.lineHeight = oldLineHeight
    const measured = this._measureDom(dom)
    measured.paragraphs.forEach((p) => {
      const _p = paragraphs[p.paragraphIndex]
      _p.boundingBox.left = p.left - rect.left
      _p.boundingBox.top = p.top - rect.top
      _p.boundingBox.width = p.width
      _p.boundingBox.height = p.height
    })
    measured.fragments.forEach((f) => {
      const _f = paragraphs[f.paragraphIndex].fragments[f.fragmentIndex]
      _f.boundingBox.left = f.left - rect.left
      _f.boundingBox.top = f.top - rect.top
      _f.boundingBox.width = f.width
      _f.boundingBox.height = f.height
    })
    const results: MeasuredCharacter[] = []
    let i = 0
    _paragraphs.forEach((oldCharacters) => {
      oldCharacters.forEach((oldCharacter) => {
        const character = measured.characters[i]
        const { paragraphIndex, fragmentIndex, characterIndex } = character
        results.push({
          ...character,
          newParagraphIndex: paragraphIndex,
          textWidth: oldCharacter.width,
          textHeight: oldCharacter.height,
          left: character.left - rect.left,
          top: character.top - rect.top,
        })
        const item = paragraphs[paragraphIndex].fragments[fragmentIndex].characters[characterIndex]
        item.boundingBox.left = results[i].left
        item.boundingBox.top = results[i].top
        item.boundingBox.width = results[i].width
        item.boundingBox.height = results[i].height
        item.textWidth = results[i].textWidth
        item.textHeight = results[i].textHeight
        i++
      })
    })
    return {
      paragraphs,
      boundingBox: new BoundingBox(0, 0, rect.width, rect.height),
    }
  }

  measure(dom?: HTMLElement): MeasuredResult {
    let destory: undefined | (() => void)
    if (!dom) {
      ({ dom, destory } = this.createDom())
    }
    const result = this.measureDom(dom)
    destory?.()
    return result
  }
}
