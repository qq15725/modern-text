import type { FragmentContent, NormalizedTextContent, ParagraphContent } from 'modern-idoc'
import type { Character } from '../content'
import type { TextOptions } from '../types'
import { diffChars } from 'diff'
import { Text } from '../Text'
import { emojiRE, isCrlf, normalizeCrlf, parseHTML } from './utils'

export interface SelectableCharacter {
  color: string
  offsetLeft: number
  offsetTop: number
  width: number
  height: number
  content: string
  isFirst?: boolean
  isLast?: boolean
  isLastSelected?: boolean
  isCrlf?: boolean
}

function normalizeStyle(style: Record<string, any>): Record<string, any> {
  const newStyle: Record<string, any> = {}
  for (const key in style) {
    if (key !== 'id' && style[key] !== undefined && style[key] !== '') {
      newStyle[key] = style[key]
    }
  }
  return newStyle
}

function textToContent(text: string): NormalizedTextContent {
  let p: ParagraphContent = {
    fragments: [],
  }
  const contents = [p]
  Array.from(text).forEach((c) => {
    if (isCrlf(c)) {
      if (!p.fragments.length) {
        p.fragments.push({ content: '\n' })
      }
      contents.push((p = { fragments: [] }))
    }
    else {
      if (p.fragments[p.fragments.length - 1]) {
        p.fragments[p.fragments.length - 1].content += c
      }
      else {
        p.fragments.push({ content: c })
      }
    }
  })
  if (!p.fragments.length) {
    p.fragments.push({ content: '\n' })
  }
  return contents
}

function contentsToText(contents: NormalizedTextContent): string {
  return contents
    .map((p) => {
      const content = normalizeCrlf(
        p.fragments.flatMap(f => f.content).join(''),
      )
      if (isCrlf(content)) {
        return ''
      }
      return content
    })
    .join('\r')
}

function contentsToCharStyles(contents: NormalizedTextContent): Record<string, any>[] {
  return contents.flatMap((p) => {
    const res = p.fragments.flatMap((f) => {
      const { content, ...style } = f
      return Array.from(normalizeCrlf(content)).map(() => ({ ...style }))
    })
    if (isCrlf(normalizeCrlf(p.fragments[p.fragments.length - 1]?.content ?? ''))) {
      return res
    }
    return [...res, {}]
  })
}

function isEqualStyle(style1: Record<string, any>, style2: Record<string, any>): boolean {
  const keys1 = Object.keys(style1)
  const keys2 = Object.keys(style2)
  const keys = Array.from(new Set([...keys1, ...keys2]))
  return !keys.length || keys.every(key => style1[key] === style2[key])
}

export class TextEditor extends HTMLElement {
  static observedAttributes = [
    'left',
    'top',
    'width',
    'height',
    'is-vertical',
  ]

  static define(): void {
    customElements.define('text-editor', this)
  }

  left = 0
  top = 0
  width = 0
  height = 0

  text = new Text()
  composition = false
  selection = [0, 0]
  prevSelection = [0, 0]

  $preview: HTMLCanvasElement
  $textInput: HTMLTextAreaElement
  $cursor: HTMLElement
  $cursorInput: HTMLElement

  protected _oldText = ''

  get selectionMinMax(): { min: number, max: number } {
    return {
      min: Math.min(...this.selection),
      max: Math.max(...this.selection),
    }
  }

  get selectedCharacters(): SelectableCharacter[] {
    const { min, max } = this.selectionMinMax
    return this.selectableCharacters.filter((_char, index) => {
      return index >= min && index < max
    })
  }

  get selectableCharacters(): SelectableCharacter[] {
    const paragraphs: Character[][][] = []
    this.text?.paragraphs.forEach((p, paragraphIndex) => {
      p.fragments.forEach((f, fragmentIndex) => {
        f.characters.forEach((c) => {
          paragraphs[paragraphIndex] ??= []
          paragraphs[paragraphIndex][fragmentIndex] ??= []
          paragraphs[paragraphIndex][fragmentIndex].push(c)
        })
      })
    })
    const toSelectableCharacter = (c: Character): SelectableCharacter => {
      return {
        color: c.computedStyle.color,
        offsetLeft: c.inlineBox.left,
        offsetTop: c.inlineBox.top,
        width: c.inlineBox.width,
        height: c.inlineBox.height,
        content: c.content,
      }
    }
    const map: SelectableCharacter[] = []
    let pos = 0
    paragraphs.forEach((p) => {
      if (p.length === 1 && p[0].length === 1 && isCrlf(p[0][0].content)) {
        const c = p[0][0]
        map[pos] = {
          ...toSelectableCharacter(c),
          isCrlf: true,
        }
      }
      else {
        p.forEach((f) => {
          f.forEach((c) => {
            map[pos] = {
              ...toSelectableCharacter(c),
            }
            pos++
            if (!isCrlf(c.content)) {
              map[pos] = {
                ...toSelectableCharacter(c),
                content: ' ',
                isLastSelected: true,
              }
            }
          })
        })
      }
      pos++
    })
    if (map[0]) {
      map[0].isFirst = true
    }
    if (map[map.length - 1]) {
      map[map.length - 1].isLast = true
    }
    return map
  }

  get cursorPosition(): { left: number, top: number, width: number, height: number, color: string } {
    let offsetLeft = 0
    let offsetTop = 0
    const { min } = this.selectionMinMax
    const char = this.selectableCharacters[min]
    if (char?.isLastSelected) {
      if (this.text.isVertical) {
        offsetTop += char?.height ?? 0
      }
      else {
        offsetLeft += char?.width ?? 0
      }
    }
    offsetLeft += char?.offsetLeft ?? 0
    offsetTop += char?.offsetTop ?? 0
    return {
      color: char?.color,
      left: offsetLeft,
      top: offsetTop,
      height: char?.height ?? 0,
      width: char?.width ?? 0,
    }
  }

  constructor() {
    super()

    const shadowRoot = this.attachShadow({ mode: 'open' })

    shadowRoot.appendChild(
      parseHTML(`
  <style>
  :host {
    position: absolute;
    width: 0;
    height: 0;
    outline-width: 2px;
    outline-style: dashed;
    --color: 0, 0, 0;
  }

  .preview {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    --selection-color: rgba(var(--color, 0, 0, 0), 0.4);
  }

  .text-input {
    position: absolute;
    z-index: -9999;
    opacity: 0;
    caret-color: transparent;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    padding: 0;
    border: 0;
  }

  .cursor {
    position: absolute;
    left: 0;
    top: 0;
    animation: cursor-blink 1s steps(2, start) infinite;
  }

  @keyframes cursor-blink {
    100% {
      display: none;
    }
  }

  .cursor-input {
    position: absolute;
    cursor: text;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    outline: 0;
  }
  </style>

  <canvas class="preview"></canvas>

  <textarea class="text-input"></textarea>

  <div class="cursor"></div>

  <div
    class="cursor-input"
    autofocus
    contenteditable="true"
  ></div>
`),
    )

    this.$preview = shadowRoot.querySelector('.preview') as HTMLCanvasElement
    this.$textInput = shadowRoot.querySelector('.text-input') as HTMLTextAreaElement
    this.$cursor = shadowRoot.querySelector('.cursor') as HTMLElement
    this.$cursorInput = shadowRoot.querySelector('.cursor-input') as HTMLElement

    this.$textInput.addEventListener('compositionstart', () => this.composition = true)
    this.$textInput.addEventListener('compositionend', () => this.composition = false)
    this.$textInput.addEventListener('keydown', this.onKeydown.bind(this))
    this.$textInput.addEventListener('input', this.onInput.bind(this) as any)
    this.$textInput.addEventListener('blur', this.onBlur.bind(this) as any)

    this.$cursorInput.addEventListener('keydown', e => e.preventDefault())
    this.$cursorInput.addEventListener('focus', this.onFocus.bind(this))
    this.$cursorInput.addEventListener('mousedown', this.onMousedown.bind(this))
  }

  update(options: TextOptions): void {
    this.text.set(options)
    this.setTextInput(this.getTextValue())
    this.render()
  }

  getTextValue(): string {
    return contentsToText(
      this.getContentValue(
        this.text.content,
      ),
    )
  }

  getContentValue(
    content: NormalizedTextContent,
    newText = contentsToText(content),
    oldText = newText,
  ): NormalizedTextContent {
    // 1. normalize text
    newText = normalizeCrlf(newText)
    newText = newText.replace(emojiRE, (emoji) => {
      if (Array.from(emoji).length > 1) {
        return '?'
      }
      return emoji
    })
    oldText = normalizeCrlf(oldText)
    // 2. diff style
    const oldStyles = contentsToCharStyles(content)
    const styles: Record<string, any>[] = []
    let styleIndex = 0
    let oldStyleIndex = 0
    let prevOldStyle: Record<string, any> = {}
    const changes = diffChars(oldText, newText)
    changes.forEach((change) => {
      const chars = Array.from(change.value)
      if (change.removed) {
        oldStyleIndex += chars.length
      }
      else {
        chars.forEach(() => {
          if (change.added) {
            styles[styleIndex] = { ...prevOldStyle }
          }
          else {
            prevOldStyle = normalizeStyle(oldStyles[oldStyleIndex])
            styles[styleIndex] = { ...prevOldStyle }
            oldStyleIndex++
          }
          styleIndex++
        })
      }
    })
    // 3. create new content
    let charIndex = 0
    const newContents: NormalizedTextContent = []
    textToContent(newText).forEach((p) => {
      let newParagraph: ParagraphContent = { fragments: [] }
      let newFragment: FragmentContent | undefined
      p.fragments.forEach((f) => {
        Array.from(f.content).forEach((char) => {
          const style = styles[charIndex] ?? {}
          if (newFragment) {
            const { content: _, ..._style } = newFragment
            if (isEqualStyle(style, _style)) {
              newFragment.content += char
            }
            else {
              newParagraph.fragments.push(newFragment)
              newFragment = { ...style, content: char }
            }
          }
          else {
            newFragment = { ...style, content: char }
          }
          charIndex++
        })
      })
      if (!isCrlf(p.fragments[p.fragments.length - 1].content)) {
        charIndex++
      }
      if (newFragment) {
        newParagraph.fragments.push(newFragment)
      }
      if (newParagraph.fragments.length) {
        newContents.push(newParagraph)
        newParagraph = { fragments: [] }
      }
    })
    return newContents
  }

  setTextInput(newText: string): void {
    this.$textInput.value = newText
    this._oldText = newText
  }

  onInput(): void {
    const newText = this.$textInput.value
    this.text.content = this.getContentValue(
      this.text.content,
      newText,
      this._oldText,
    )
    this._oldText = newText
    this.updateSelection()
    this.render()
  }

  onKeydown(e: KeyboardEvent): void {
    switch (e.key) {
      case 'Escape':
        // TODO 保存
        break
    }
    this.updateSelection()
    this.render()
    setTimeout(() => {
      this.updateSelection()
      this.render()
    }, 100)
  }

  onFocus(e: Event): void {
    e.preventDefault()
    this.$cursorInput.blur()
    this.$textInput?.focus()
  }

  onBlur(): void {
    // this.style.visibility = 'hidden'
  }

  findNearest(options: {
    x: number
    y: number
    xWeight?: number
    yWeight?: number
    filter?: (char: SelectableCharacter) => boolean
  }): number {
    const { x, y, xWeight = 1, yWeight = 1, filter } = options

    const char = this.selectableCharacters.reduce(
      (prev, current, index) => {
        if (filter?.(current) === false)
          return prev
        const diff = (
          Math.abs(current.offsetLeft + current.width / 2 - x) * xWeight
          + Math.abs(current.offsetTop + current.height / 2 - y) * yWeight
        )
        if (diff < prev.diff) {
          return {
            diff,
            index,
            value: current,
          }
        }
        return prev
      },
      {
        diff: Number.MAX_SAFE_INTEGER,
        index: -1,
        value: undefined as SelectableCharacter | undefined,
      },
    )

    if (char?.value) {
      const middleX = char.value.offsetLeft + char.value.width / 2
      if (x > middleX && !char.value.isCrlf && !char.value.isLastSelected) {
        return char.index + 1
      }
      return char.index
    }

    return -1
  }

  updateSelection(): void {
    if (this.composition) {
      this.selection = this.prevSelection
    }
    else {
      let count = 0
      const _selection: number[] = []
      this.selectableCharacters.forEach((char, index) => {
        if (count <= this.$textInput.selectionStart) {
          _selection[0] = index
        }
        else if (count <= this.$textInput.selectionEnd) {
          _selection[1] = index
        }
        count += char.content.length
      })
      this.selection = _selection
      this.prevSelection = this.selection
    }
  }

  updateDOMSelection(): void {
    let start = 0
    let end = 0
    this.selectableCharacters.forEach((char, index) => {
      if (index < this.selectionMinMax.min) {
        start += char.content.length
        end = start
      }
      else if (index < this.selectionMinMax.max) {
        end += char.content.length
      }
    })
    this.$textInput.selectionStart = start
    this.$textInput.selectionEnd = end
  }

  onMousedown(e: MouseEvent): void {
    const box = this.$cursorInput.getBoundingClientRect()
    const getOffset = (e: MouseEvent): { x: number, y: number } => {
      return {
        x: e.offsetX - box.x + this.left,
        y: e.offsetY - box.y + this.top,
      }
    }
    const index = this.findNearest(getOffset(e))
    this.selection = [index, index]
    this.updateDOMSelection()
    this.render()
    const onMousemove = (e: MouseEvent): void => {
      this.selection[1] = this.findNearest(getOffset(e))
      this.updateDOMSelection()
      this.render()
    }
    const onMouseup = (): void => {
      document.removeEventListener('mousemove', onMousemove)
      document.removeEventListener('mouseup', onMouseup)
    }
    document.addEventListener('mousemove', onMousemove)
    document.addEventListener('mouseup', onMouseup)
  }

  render(): void {
    this.text.update()

    this.width = this.text.boundingBox.width
    this.height = this.text.boundingBox.height

    const isVertical = this.text.isVertical

    this.style.left = `${this.left}px`
    this.style.top = `${this.top}px`
    this.style.width = `${this.width}px`
    this.style.height = `${this.height}px`

    // preview
    this.text.render({
      view: this.$preview,
    })

    // selection
    const ctx = this.$preview?.getContext('2d')
    if (ctx) {
      ctx.fillStyle = getComputedStyle(this.$preview).getPropertyValue('--selection-color')
      this.selectedCharacters.forEach((char) => {
        if (char.isLastSelected) {
          return
        }
        ctx.fillRect(
          char.offsetLeft,
          char.offsetTop,
          char.width,
          char.height,
        )
      })
    }

    // cursor
    const cursorPosition = this.cursorPosition
    this.$cursor.style.backgroundColor = cursorPosition.color ?? 'rgba(var(--color)'
    this.$cursor.style.left = `${cursorPosition.left}px`
    this.$cursor.style.top = `${cursorPosition.top}px`
    this.$cursor.style.height = isVertical ? '1px' : `${cursorPosition.height}px`
    this.$cursor.style.width = isVertical ? `${cursorPosition.width}px` : '1px'
  }

  attributeChangedCallback(name: string, oldValue: any, newValue: any): void {
    switch (name) {
      case 'left':
      case 'top':
      case 'width':
      case 'height':
        ;(this as any)[name] = newValue
        this.render()
        break
    }
  }
}
