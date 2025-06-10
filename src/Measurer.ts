import type { NormalizedStyle } from 'modern-idoc'
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

export interface measureDOMResult {
  paragraphs: Paragraph[]
  boundingBox: BoundingBox
}

export class Measurer {
  static notZeroStyles = new Set([
    'width',
    'height',
  ])

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
    'margin',
    'marginLeft',
    'marginTop',
    'marginRight',
    'marginBottom',
    'padding',
    'paddingLeft',
    'paddingTop',
    'paddingRight',
    'paddingBottom',
  ])

  protected _toDOMStyle(style: Record<string, any>): Record<string, any> {
    const _style: Record<string, any> = {}
    for (const key in style) {
      const value = (style as any)[key]
      if (Measurer.notZeroStyles.has(key) && value === 0) {
        //
      }
      else if (typeof value === 'number' && Measurer.pxStyles.has(key)) {
        _style[key] = `${value}px`
      }
      else {
        _style[key] = value
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
  createDOM(paragraphs: Paragraph[], rootStyle: NormalizedStyle): HTMLElement {
    const dom = document.createElement('section')
    const style: NormalizedStyle = { ...rootStyle }
    const isHorizontal = rootStyle.writingMode.includes('horizontal')
    switch (rootStyle.textAlign) {
      case 'start':
      case 'left':
        style.justifyContent = 'flex-start'
        break
      case 'center':
        style.justifyContent = 'center'
        break
      case 'end':
      case 'right':
        style.justifyContent = 'flex-end'
        break
    }
    switch (rootStyle.verticalAlign) {
      case 'top':
        style.alignItems = 'flex-start'
        break
      case 'middle':
        style.alignItems = 'center'
        break
      case 'bottom':
        style.alignItems = 'flex-end'
        break
    }
    const isFlex = Boolean(style.justifyContent || style.alignItems)
    Object.assign(dom.style, {
      ...this._toDOMStyle({
        ...style,
        boxSizing: style.boxSizing ?? 'border-box',
        display: style.display ?? (isFlex ? 'inline-flex' : undefined),
        width: style.width ?? 'max-content',
        height: style.height ?? 'max-content',
      }),
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-all',
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
        ...this._toDOMStyle(paragraph.style),
      })
      paragraph.fragments.forEach((fragment) => {
        const span = document.createElement('span')
        Object.assign(span.style, {
          verticalAlign: 'inherit',
          ...this._toDOMStyle(fragment.style),
        })
        span.appendChild(document.createTextNode(fragment.content))
        li.appendChild(span)
      })
      ul.appendChild(li)
    })
    dom.appendChild(ul)
    return dom
  }

  measureDOMText(text: Text): { content: string, top: number, left: number, width: number, height: number }[] {
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

  measureDOM(dom: HTMLElement): { paragraphs: MeasuredParagraph[], fragments: MeasuredFragment[], characters: MeasuredCharacter[] } {
    const paragraphs: MeasuredParagraph[] = []
    const fragments: MeasuredFragment[] = []
    const characters: MeasuredCharacter[] = []
    dom.querySelectorAll('li').forEach((pDOM, paragraphIndex) => {
      const pBox = pDOM.getBoundingClientRect()
      paragraphs.push({
        paragraphIndex,
        left: pBox.left,
        top: pBox.top,
        width: pBox.width,
        height: pBox.height,
      })
      pDOM.querySelectorAll(':scope > *').forEach((fDOM, fragmentIndex) => {
        const fBox = fDOM.getBoundingClientRect()
        fragments.push({
          paragraphIndex,
          fragmentIndex,
          left: fBox.left,
          top: fBox.top,
          width: fBox.width,
          height: fBox.height,
        })
        let characterIndex = 0
        if (!fDOM.children.length && fDOM.firstChild instanceof window.Text) {
          this.measureDOMText(fDOM.firstChild).forEach((char) => {
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
          fDOM.querySelectorAll(':scope > *').forEach((cDOM) => {
            if (cDOM.firstChild instanceof window.Text) {
              this.measureDOMText(cDOM.firstChild).forEach((char) => {
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

  measureParagraphDOM(paragraphs: Paragraph[], dom: HTMLElement): measureDOMResult {
    const rect = dom.getBoundingClientRect()
    const measured = this.measureDOM(dom)
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

  measure(paragraphs: Paragraph[], rootStyle: NormalizedStyle, dom?: HTMLElement): measureDOMResult {
    let destory: undefined | (() => void)
    if (!dom) {
      dom = this.createDOM(paragraphs, rootStyle)
      Object.assign(dom.style, {
        position: 'fixed',
        visibility: 'hidden',
      })
      document.body.appendChild(dom)
      destory = () => dom?.parentNode?.removeChild(dom)
    }
    const result = this.measureParagraphDOM(paragraphs, dom)
    destory?.()
    return result
  }
}
