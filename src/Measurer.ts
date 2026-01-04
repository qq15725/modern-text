import type { FullStyle } from 'modern-idoc'
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

  protected _toDomStyle(style: Record<string, any>): Record<string, any> {
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
  createDom(paragraphs: Paragraph[], rootStyle: FullStyle): HTMLElement {
    const dom = document.createElement('section')
    const style: FullStyle = { ...rootStyle }
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
      ...this._toDomStyle({
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
        ...this._toDomStyle(paragraph.style),
      })
      paragraph.fragments.forEach((fragment) => {
        const span = document.createElement('span')
        Object.assign(span.style, {
          verticalAlign: 'inherit',
          ...this._toDomStyle(fragment.style),
        })
        span.appendChild(document.createTextNode(fragment.content))
        li.appendChild(span)
      })
      ul.appendChild(li)
    })
    dom.appendChild(ul)
    return dom
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
        left: pBox.x,
        top: pBox.y,
        width: pBox.width,
        height: pBox.height,
      })
      pDom.querySelectorAll(':scope > *').forEach((fDom, fragmentIndex) => {
        const fBox = fDom.getBoundingClientRect()
        fragments.push({
          paragraphIndex,
          fragmentIndex,
          left: fBox.x,
          top: fBox.y,
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
          fDom.querySelectorAll(':scope > *').forEach((cDOM) => {
            if (cDOM.firstChild instanceof window.Text) {
              this.measureDomText(cDOM.firstChild).forEach((char) => {
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
      const box = paragraphs[p.paragraphIndex].lineBox
      box.left = p.left - rect.left
      box.top = p.top - rect.top
      box.width = p.width
      box.height = p.height
    })
    measured.fragments.forEach((f) => {
      const box = paragraphs[f.paragraphIndex].fragments[f.fragmentIndex].inlineBox
      box.left = f.left - rect.left
      box.top = f.top - rect.top
      box.width = f.width
      box.height = f.height
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
      const { fontHeight, isVertical, inlineBox, lineBox } = item
      const result = results[i]
      // inlineBox
      inlineBox.left = result.left
      inlineBox.top = result.top
      inlineBox.width = result.width
      inlineBox.height = result.height

      // lineBox
      if (isVertical) {
        lineBox.left = result.left + (result.width - fontHeight) / 2
        lineBox.top = result.top
        lineBox.width = fontHeight
        lineBox.height = result.height
      }
      else {
        lineBox.left = result.left
        lineBox.top = result.top + (result.height - fontHeight) / 2
        lineBox.width = result.width
        lineBox.height = fontHeight
      }

      i++
    })

    return {
      paragraphs,
      boundingBox: new BoundingBox(0, 0, rect.width, rect.height),
    }
  }

  measure(paragraphs: Paragraph[], rootStyle: FullStyle, dom?: HTMLElement): MeasureDomResult {
    let destory: undefined | (() => void)
    if (!dom) {
      dom = this.createDom(paragraphs, rootStyle)
      Object.assign(dom.style, {
        position: 'fixed',
        visibility: 'hidden',
      })
      document.body.appendChild(dom)
      destory = () => dom?.parentNode?.removeChild(dom)
    }
    const result = this.measureParagraphDom(paragraphs, dom)
    destory?.()
    return result
  }
}
