import type { ITextStyle } from 'modern-idoc'
import type { Paragraph } from './content'
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
  static pxStyles = new Set([
    'width',
    'height',
    'fontSize',
    'letterSpacing',
    'textStrokeWidth',
    'textIndent',
    'shadowOffsetX',
    'shadowOffsetY',
    'shadowBlur',
    'marginLeft',
    'marginTop',
    'marginRight',
    'marginBottom',
    'paddingLeft',
    'paddingTop',
    'paddingRight',
    'paddingBottom',
  ])

  protected _styleToDomStyle(style: Record<string, any>): Record<string, any> {
    const _style: Record<string, any> = { ...style }
    for (const key in style) {
      if (Measurer.pxStyles.has(key)) {
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
  createParagraphDom(paragraphs: Paragraph[], rootStyle: ITextStyle): { dom: HTMLElement, destory: () => void } {
    const documentFragment = document.createDocumentFragment()
    const dom = document.createElement('section')
    const style: Record<string, any> = { ...rootStyle }
    const isHorizontal = rootStyle.writingMode.includes('horizontal')
    switch (rootStyle.textAlign) {
      case 'start':
      case 'left':
        style.justifyContent = 'start'
        break
      case 'center':
        style.justifyContent = 'center'
        break
      case 'end':
      case 'right':
        style.justifyContent = 'end'
        break
    }
    switch (rootStyle.verticalAlign) {
      case 'top':
        style.alignItems = 'top'
        break
      case 'middle':
        style.alignItems = 'center'
        break
      case 'bottom':
        style.alignItems = 'end'
        break
    }
    const isFlex = Boolean(style.justifyContent || style.alignItems)
    Object.assign(dom.style, {
      boxSizing: 'border-box',
      display: isFlex ? 'inline-flex' : undefined,
      width: 'max-content',
      height: 'max-content',
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-all',
      ...this._styleToDomStyle(style),
      position: 'fixed',
      visibility: 'hidden',
    })
    const ul = document.createElement('ul')
    Object.assign(ul.style, {
      verticalAlign: 'inherit',
      listStyleType: 'inherit',
      padding: '0',
      margin: '0',
      width: isFlex && isHorizontal ? '100%' : undefined,
      height: isFlex && !isHorizontal ? '100%' : undefined,
    })
    paragraphs.forEach((paragraph) => {
      const li = document.createElement('li')
      Object.assign(li.style, {
        verticalAlign: 'inherit',
        ...this._styleToDomStyle(paragraph.style),
      })
      paragraph.fragments.forEach((fragment) => {
        const span = document.createElement('span')
        Object.assign(span.style, {
          verticalAlign: 'inherit',
          ...this._styleToDomStyle(fragment.style),
        })
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

  measureDomText(text: Text): { content: string, top: number, left: number, width: number, height: number }[] {
    const range = document.createRange()
    range.selectNodeContents(text)
    const data = text.data ?? ''
    let offset = 0
    return Array.from(data)
      .map((char) => {
        const start = offset += data.substring(offset).indexOf(char)
        const end = start + char.length
        offset += char.length
        range.setStart(text, Math.max(start, 0))
        range.setEnd(text, end)
        const rects = range.getClientRects?.() ?? [range.getBoundingClientRect()]
        let rect = rects[rects.length - 1]
        if (rects.length > 1 && rect.width < 2) {
          rect = rects[rects.length - 2]
        }
        const content = range.toString()
        if (content !== '' && rect && rect.width + rect.height !== 0) {
          return {
            content,
            top: rect.top,
            left: rect.left,
            height: rect.height,
            width: rect.width,
          }
        }
        return undefined
      })
      .filter(Boolean) as any
  }

  measureDom(dom: HTMLElement): { paragraphs: MeasuredParagraph[], fragments: MeasuredFragment[], characters: MeasuredCharacter[] } {
    const paragraphs: MeasuredParagraph[] = []
    const fragments: MeasuredFragment[] = []
    const characters: MeasuredCharacter[] = []
    dom.querySelectorAll('li').forEach((pDom, paragraphIndex) => {
      const pBox = pDom.getBoundingClientRect()
      paragraphs.push({
        paragraphIndex,
        left: pBox.left,
        top: pBox.top,
        width: pBox.width,
        height: pBox.height,
      })
      pDom.querySelectorAll(':scope > *').forEach((fDom, fragmentIndex) => {
        const fBox = fDom.getBoundingClientRect()
        fragments.push({
          paragraphIndex,
          fragmentIndex,
          left: fBox.left,
          top: fBox.top,
          width: fBox.width,
          height: fBox.height,
        })
        let characterIndex = 0
        if (!fDom.children.length && fDom.firstChild instanceof window.Text) {
          this.measureDomText(fDom.firstChild).forEach((char) => {
            characters.push({
              ...char,
              newParagraphIndex: -1,
              paragraphIndex,
              fragmentIndex,
              characterIndex: characterIndex++,
              textWidth: -1,
              textHeight: -1,
            })
          })
        }
        else {
          fDom.querySelectorAll(':scope > *').forEach((cDom) => {
            if (cDom.firstChild instanceof window.Text) {
              this.measureDomText(cDom.firstChild).forEach((char) => {
                characters.push({
                  ...char,
                  newParagraphIndex: -1,
                  paragraphIndex,
                  fragmentIndex,
                  characterIndex: characterIndex++,
                  textWidth: -1,
                  textHeight: -1,
                })
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

  measureParagraphDom(paragraphs: Paragraph[], dom: HTMLElement): MeasureDomResult {
    const rect = dom.getBoundingClientRect()
    const measured = this.measureDom(dom)
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

  measure(paragraphs: Paragraph[], rootStyle: ITextStyle, dom?: HTMLElement): MeasureDomResult {
    let destory: undefined | (() => void)
    if (!dom) {
      ({ dom, destory } = this.createParagraphDom(paragraphs, rootStyle))
    }
    const result = this.measureParagraphDom(paragraphs, dom)
    destory?.()
    return result
  }
}
