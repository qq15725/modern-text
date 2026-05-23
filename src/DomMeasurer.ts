import type { FullStyle } from 'modern-idoc'
import type { Fragment, Paragraph } from './content'
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

export interface MeasuredCharacterRect {
  content: string
  top: number
  left: number
  width: number
  height: number
}

export interface MeasureDomResult {
  paragraphs: Paragraph[]
  boundingBox: BoundingBox
}

interface RootDomStyles {
  section: Record<string, any>
  ul: Record<string, any>
}

let sharedContainer: HTMLDivElement | undefined

function getSharedContainer(): HTMLDivElement {
  if (sharedContainer?.isConnected) {
    return sharedContainer
  }
  const container = document.createElement('div')
  container.dataset.modernText = 'measurer'
  Object.assign(container.style, {
    position: 'fixed',
    left: '0',
    top: '0',
    visibility: 'hidden',
    pointerEvents: 'none',
  })
  document.body.appendChild(container)
  sharedContainer = container
  return container
}

export class DomMeasurer {
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

  protected _styleCache = new WeakMap<object, Record<string, any>>()
  protected _mountedDom?: HTMLElement
  protected _mountedSignature?: string

  protected _toDomStyle(style: Record<string, any>): Record<string, any> {
    const cached = this._styleCache.get(style)
    if (cached) {
      return cached
    }
    const domStyle: Record<string, any> = {}
    const { notZeroStyles, pxStyles } = DomMeasurer
    for (const key in style) {
      const value = style[key]
      if (notZeroStyles.has(key) && value === 0) {
        continue
      }
      domStyle[key] = typeof value === 'number' && pxStyles.has(key)
        ? `${value}px`
        : value
    }
    this._styleCache.set(style, domStyle)
    return domStyle
  }

  protected _resolveRootStyles(rootStyle: FullStyle): RootDomStyles {
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
    return {
      section: {
        ...this._toDomStyle({
          ...style,
          boxSizing: style.boxSizing ?? 'border-box',
          display: style.display ?? (isFlex ? 'inline-flex' : undefined),
          width: style.width ?? 'max-content',
          height: style.height ?? 'max-content',
        }),
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-all',
      },
      ul: {
        verticalAlign: 'inherit',
        listStyleType: 'inherit',
        padding: '0',
        margin: '0',
        width: isFlex && isHorizontal ? '100%' : undefined,
        height: isFlex && !isHorizontal ? '100%' : undefined,
      },
    }
  }

  protected _applyRootStyle(section: HTMLElement, ul: HTMLElement, rootStyle: FullStyle): void {
    const styles = this._resolveRootStyles(rootStyle)
    section.removeAttribute('style')
    Object.assign(section.style, styles.section)
    ul.removeAttribute('style')
    Object.assign(ul.style, styles.ul)
  }

  protected _applyLiStyle(li: HTMLElement, paragraph: Paragraph): void {
    li.removeAttribute('style')
    li.style.verticalAlign = 'inherit'
    Object.assign(li.style, this._toDomStyle(paragraph.style))
  }

  protected _applySpanStyle(span: HTMLElement, fragment: Fragment): void {
    span.removeAttribute('style')
    span.style.verticalAlign = 'inherit'
    Object.assign(span.style, this._toDomStyle(fragment.style))
  }

  protected _applyFragmentContent(span: HTMLElement, fragment: Fragment): void {
    const textNode = span.firstChild as Text | null
    if (textNode) {
      if (textNode.data !== fragment.content) {
        textNode.data = fragment.content
      }
    }
    else {
      span.appendChild(document.createTextNode(fragment.content))
    }
  }

  protected _hide(element: HTMLElement): void {
    element.style.visibility = 'hidden'
  }

  protected _signature(paragraphs: Paragraph[]): string {
    let sig = `${paragraphs.length}`
    for (let i = 0; i < paragraphs.length; i++) {
      sig += `:${paragraphs[i].fragments.length}`
    }
    return sig
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
    const section = document.createElement('section')
    const ul = document.createElement('ul')
    this._applyRootStyle(section, ul, rootStyle)
    paragraphs.forEach((paragraph) => {
      const li = document.createElement('li')
      this._applyLiStyle(li, paragraph)
      paragraph.fragments.forEach((fragment) => {
        const span = document.createElement('span')
        this._applySpanStyle(span, fragment)
        this._applyFragmentContent(span, fragment)
        li.appendChild(span)
      })
      ul.appendChild(li)
    })
    section.appendChild(ul)
    return section
  }

  protected _patchDom(dom: HTMLElement, paragraphs: Paragraph[], rootStyle: FullStyle, hidden: boolean): void {
    const ul = dom.firstChild as HTMLElement
    this._applyRootStyle(dom, ul, rootStyle)
    if (hidden) {
      this._hide(dom)
    }
    const lis = ul.children
    for (let i = 0; i < paragraphs.length; i++) {
      const li = lis[i] as HTMLElement
      this._applyLiStyle(li, paragraphs[i])
      const fragments = paragraphs[i].fragments
      const spans = li.children
      for (let j = 0; j < fragments.length; j++) {
        const span = spans[j] as HTMLElement
        this._applySpanStyle(span, fragments[j])
        this._applyFragmentContent(span, fragments[j])
      }
    }
  }

  measureDomText(text: Text): MeasuredCharacterRect[] {
    const data = text.data ?? ''
    const results: MeasuredCharacterRect[] = []
    if (!data.length) {
      return results
    }
    const range = document.createRange()
    let i = 0
    while (i < data.length) {
      const cp = data.codePointAt(i)!
      const end = i + (cp > 0xFFFF ? 2 : 1)
      range.setStart(text, i)
      range.setEnd(text, end)
      const rects = range.getClientRects?.()
      let rect: DOMRect | undefined
      if (rects && rects.length) {
        rect = rects[rects.length - 1]
        if (rects.length > 1 && rect.width < 2) {
          rect = rects[rects.length - 2]
        }
      }
      else {
        rect = range.getBoundingClientRect()
      }
      if (rect && rect.width + rect.height !== 0) {
        results.push({
          content: data.slice(i, end),
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
        })
      }
      i = end
    }
    return results
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
        const pushChars = (textNode: Text): void => {
          this.measureDomText(textNode).forEach((char) => {
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
        if (!fDom.children.length && fDom.firstChild instanceof window.Text) {
          pushChars(fDom.firstChild)
        }
        else {
          fDom.querySelectorAll(':scope > *').forEach((cDom) => {
            if (cDom.firstChild instanceof window.Text) {
              pushChars(cDom.firstChild)
            }
          })
        }
      })
    })
    return { paragraphs, fragments, characters }
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
    measured.characters.forEach((character) => {
      const { paragraphIndex, fragmentIndex, characterIndex } = character
      const left = character.left - rect.left
      const top = character.top - rect.top
      results.push({
        ...character,
        newParagraphIndex: paragraphIndex,
        left,
        top,
      })
      const item = paragraphs[paragraphIndex].fragments[fragmentIndex].characters[characterIndex]
      const { fontHeight, isVertical, inlineBox, lineBox } = item
      inlineBox.left = left
      inlineBox.top = top
      inlineBox.width = character.width
      inlineBox.height = character.height
      if (isVertical) {
        lineBox.left = left + (character.width - fontHeight) / 2
        lineBox.top = top
        lineBox.width = fontHeight
        lineBox.height = character.height
      }
      else {
        lineBox.left = left
        lineBox.top = top + (character.height - fontHeight) / 2
        lineBox.width = character.width
        lineBox.height = fontHeight
      }
    })

    return {
      paragraphs,
      boundingBox: new BoundingBox(0, 0, rect.width, rect.height),
    }
  }

  measure(paragraphs: Paragraph[], rootStyle: FullStyle, dom?: HTMLElement): MeasureDomResult {
    return this.measureParagraphDom(paragraphs, dom ?? this._mount(paragraphs, rootStyle))
  }

  protected _mount(paragraphs: Paragraph[], rootStyle: FullStyle): HTMLElement {
    const signature = this._signature(paragraphs)
    if (this._mountedDom?.isConnected && this._mountedSignature === signature) {
      this._patchDom(this._mountedDom, paragraphs, rootStyle, true)
      return this._mountedDom
    }
    this._unmount()
    const dom = this.createDom(paragraphs, rootStyle)
    this._hide(dom)
    getSharedContainer().appendChild(dom)
    this._mountedDom = dom
    this._mountedSignature = signature
    return dom
  }

  protected _unmount(): void {
    this._mountedDom?.parentNode?.removeChild(this._mountedDom)
    this._mountedDom = undefined
    this._mountedSignature = undefined
  }

  dispose(): void {
    this._unmount()
  }
}
