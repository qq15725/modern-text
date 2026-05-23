import type { Fonts } from 'modern-font'
import type { FullStyle } from 'modern-idoc'
import type { Character, Paragraph } from './content'
import type { MeasureDomResult } from './DomMeasurer'
import type { TextMeasurer } from './types'
import { fonts as globalFonts } from 'modern-font'
import { BoundingBox } from 'modern-path2d'

type Edge = 'Top' | 'Right' | 'Bottom' | 'Left'

/** Resolve a box-model side: explicit per-side value ?? shorthand ?? 0. */
function side(style: Record<string, any>, name: 'padding' | 'margin', edge: Edge): number {
  return (style[`${name}${edge}`] ?? style[name] ?? 0) as number
}

/**
 * Pure-JS, DOM-free text measurer — a drop-in alternative to {@link DomMeasurer}.
 *
 * Instead of mounting a `<section>/<ul>/<li>/<span>` tree and reading
 * `getBoundingClientRect()`, it computes the same four-level boxes
 * (`character.inlineBox`/`lineBox`, `fragment.inlineBox`, `paragraph.lineBox`)
 * from `modern-font` glyph advances, so the downstream
 * measure → glyph → plugin pipeline is unchanged and it runs in Node/SSR/Worker.
 *
 * ## Scope
 * - `horizontal-tb` (LTR) and `vertical-rl` (columns right-to-left, glyphs top↓)
 * - line breaking: `word-break: break-all` (greedy, break anywhere) + explicit `\n`
 * - per-line `text-align` (start/left/center/end/right), `text-indent` (first line)
 * - box model: root + paragraph `padding`/`margin` (horizontal), `letter-spacing`,
 *   `line-height`; block `vertical-align` (top/middle/bottom) at fixed height
 *
 * ## Not yet implemented (TODO)
 * - UAX#14 `word-break: normal` + 避头尾/kinsoku (`line-break`)
 * - BiDi, per-fragment inline `vertical-align`, borders
 * - vertical: per-paragraph margin/padding and block alignment
 * - kerning/ligatures (GSUB/GPOS) — fine for CJK, diverges for proportional Latin
 *
 * Coordinates are relative to the root border-box top-left (matching the DOM
 * measurer, whose rects are taken relative to `section.getBoundingClientRect()`).
 */
export class FontMeasurer implements TextMeasurer {
  constructor(public fonts?: Fonts) {}

  measure(
    paragraphs: Paragraph[],
    rootStyle: FullStyle,
    _dom?: HTMLElement,
    fonts: Fonts | undefined = this.fonts,
  ): MeasureDomResult {
    const _fonts = fonts ?? globalFonts

    // Glyph advances/metrics must be known before placement.
    for (const paragraph of paragraphs) {
      for (const fragment of paragraph.fragments) {
        for (const character of fragment.characters) {
          character.measureGlyph(_fonts)
        }
      }
    }

    return rootStyle.writingMode.includes('vertical')
      ? this._measureVertical(paragraphs, rootStyle)
      : this._measureHorizontal(paragraphs, rootStyle)
  }

  protected _rootPadding(rootStyle: FullStyle): { top: number, right: number, bottom: number, left: number } {
    return {
      top: side(rootStyle, 'padding', 'Top'),
      right: side(rootStyle, 'padding', 'Right'),
      bottom: side(rootStyle, 'padding', 'Bottom'),
      left: side(rootStyle, 'padding', 'Left'),
    }
  }

  protected _measureHorizontal(paragraphs: Paragraph[], rootStyle: FullStyle): MeasureDomResult {
    const rootPad = this._rootPadding(rootStyle)
    // border-box: the content area excludes padding.
    const hasWidth = typeof rootStyle.width === 'number'
    const availWidth = hasWidth
      ? (rootStyle.width as number) - rootPad.left - rootPad.right
      : Infinity

    let y = rootPad.top
    let maxRight = rootPad.left

    for (const paragraph of paragraphs) {
      const pStyle = paragraph.computedStyle // inherited props: align / indent / font
      // Box-model props (margin/padding) do NOT inherit — read the paragraph's own
      // style, not computedStyle (which would double-count the root's padding).
      const pBox = paragraph.style as Record<string, any>
      const mTop = side(pBox, 'margin', 'Top')
      const mBottom = side(pBox, 'margin', 'Bottom')
      const mLeft = side(pBox, 'margin', 'Left')
      const mRight = side(pBox, 'margin', 'Right')
      const pTop = side(pBox, 'padding', 'Top')
      const pBottom = side(pBox, 'padding', 'Bottom')
      const pLeft = side(pBox, 'padding', 'Left')
      const pRight = side(pBox, 'padding', 'Right')

      const liLeft = rootPad.left + mLeft + pLeft
      const liAvail = availWidth === Infinity
        ? Infinity
        : availWidth - mLeft - mRight - pLeft - pRight

      y += mTop + pTop
      const paraTop = y
      let paraRight = liLeft

      const lines = this._breakLines(paragraph, liAvail)
      const align = pStyle.textAlign
      const indent = pStyle.textIndent ?? 0

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        const lineIndent = i === 0 ? indent : 0

        // Line-box height = max contribution; an empty line keeps the paragraph's strut.
        let lineHeight = pStyle.fontSize * pStyle.lineHeight
        let contentWidth = 0
        for (const c of line) {
          if (c.fontHeight > lineHeight) {
            lineHeight = c.fontHeight
          }
          contentWidth += this._advance(c)
        }

        let x = liLeft + lineIndent
        if (liAvail !== Infinity) {
          const slack = liAvail - lineIndent - contentWidth
          if (align === 'center') {
            x += slack / 2
          }
          else if (align === 'end' || align === 'right') {
            x += slack
          }
        }

        for (const c of line) {
          const adv = c.advanceWidth
          const contentHeight = c.advanceHeight // font content box (ascent+descent)
          const fontHeight = c.fontHeight // fontSize * line-height
          // inlineBox mirrors the browser's per-character client rect: the font
          // content box, vertically centered within the line box. (getClientRects
          // returns the content box — ascent+descent — not the full line box.)
          c.inlineBox.left = x
          c.inlineBox.top = y + (lineHeight - contentHeight) / 2
          c.inlineBox.width = adv
          c.inlineBox.height = contentHeight
          // lineBox: the line-height-tall strip, derived exactly as the DOM
          // measurer does (DomMeasurer.measureParagraphDom, horizontal branch).
          c.lineBox.left = x
          c.lineBox.top = c.inlineBox.top + (contentHeight - fontHeight) / 2
          c.lineBox.width = adv
          c.lineBox.height = fontHeight
          x += this._advance(c)
        }

        if (x > paraRight) {
          paraRight = x
        }
        y += lineHeight
      }

      if (paraRight > maxRight) {
        maxRight = paraRight
      }

      for (const fragment of paragraph.fragments) {
        this._unionInto(fragment.inlineBox, fragment.characters.map(c => c.inlineBox))
      }
      paragraph.lineBox.left = liLeft
      paragraph.lineBox.top = paraTop
      paragraph.lineBox.width = liAvail === Infinity ? paraRight - liLeft : liAvail
      paragraph.lineBox.height = y - paraTop

      y += pBottom + mBottom
    }

    const contentBottom = y + rootPad.bottom
    const totalWidth = hasWidth ? (rootStyle.width as number) : maxRight + rootPad.right
    const totalHeight = typeof rootStyle.height === 'number' ? (rootStyle.height as number) : contentBottom

    // Block-level vertical-align: shift the whole block within a fixed height.
    if (typeof rootStyle.height === 'number') {
      const slack = totalHeight - contentBottom
      const va = rootStyle.verticalAlign
      const dy = va === 'middle' ? slack / 2 : va === 'bottom' ? slack : 0
      if (dy) {
        this._shiftAll(paragraphs, dy)
      }
    }

    return {
      paragraphs,
      boundingBox: new BoundingBox(0, 0, totalWidth, totalHeight),
    }
  }

  /**
   * Vertical writing-mode (`vertical-rl`): columns stack right-to-left, glyphs
   * flow top→bottom. It is the horizontal layout with the inline and block axes
   * swapped — the inline (down-column) advance is `advanceWidth` (CJK upright = em;
   * Latin is rotated, so its advance ≈ its width), the cross-axis content box is
   * `advanceHeight`, and the column thickness is `fontHeight`. The lineBox is
   * derived exactly as DomMeasurer.measureParagraphDom's vertical branch, so it
   * stays accurate even though inlineBox carries the content-box rounding residual.
   *
   * v1: `vertical-rl` only; no per-paragraph margin/padding or block alignment.
   */
  protected _measureVertical(paragraphs: Paragraph[], rootStyle: FullStyle): MeasureDomResult {
    const rootPad = this._rootPadding(rootStyle)
    const hasHeight = typeof rootStyle.height === 'number'
    const availHeight = hasHeight
      ? (rootStyle.height as number) - rootPad.top - rootPad.bottom
      : Infinity

    // Phase 1: break paragraphs into columns (top→bottom, break-all on availHeight).
    const columns: { chars: Character[], thickness: number }[] = []
    for (const paragraph of paragraphs) {
      const strut = paragraph.computedStyle.fontSize * paragraph.computedStyle.lineHeight
      for (const line of this._breakLines(paragraph, availHeight)) {
        let thickness = strut
        for (const c of line) {
          if (c.fontHeight > thickness) {
            thickness = c.fontHeight
          }
        }
        columns.push({ chars: line, thickness })
      }
    }

    const totalThickness = columns.reduce((sum, c) => sum + c.thickness, 0)
    const hasWidth = typeof rootStyle.width === 'number'
    const blockWidth = hasWidth
      ? Math.max((rootStyle.width as number) - rootPad.left - rootPad.right, totalThickness)
      : totalThickness

    // Phase 2: place columns right-to-left, characters top→bottom.
    let xRight = rootPad.left + blockWidth
    let maxBottom = rootPad.top
    for (const column of columns) {
      xRight -= column.thickness
      const colLeft = xRight
      let y = rootPad.top
      for (const c of column.chars) {
        const advance = c.advanceWidth // inline-axis advance (down the column)
        const contentWidth = c.advanceHeight // cross-axis content box (ascent+descent)
        const fontHeight = c.fontHeight
        c.inlineBox.top = y
        c.inlineBox.height = advance
        c.inlineBox.width = contentWidth
        c.inlineBox.left = colLeft + (column.thickness - contentWidth) / 2
        c.lineBox.left = c.inlineBox.left + (contentWidth - fontHeight) / 2
        c.lineBox.top = y
        c.lineBox.width = fontHeight
        c.lineBox.height = advance
        y += this._advance(c)
      }
      if (y > maxBottom) {
        maxBottom = y
      }
    }

    for (const paragraph of paragraphs) {
      for (const fragment of paragraph.fragments) {
        this._unionInto(fragment.inlineBox, fragment.characters.map(c => c.inlineBox))
      }
      this._unionInto(
        paragraph.lineBox,
        paragraph.fragments.flatMap(f => f.characters.map(c => c.inlineBox)),
      )
    }

    const totalWidth = hasWidth ? (rootStyle.width as number) : blockWidth + rootPad.left + rootPad.right
    const totalHeight = hasHeight ? (rootStyle.height as number) : maxBottom + rootPad.bottom
    return {
      paragraphs,
      boundingBox: new BoundingBox(0, 0, totalWidth, totalHeight),
    }
  }

  /** Advance step including CSS letter-spacing (px). */
  protected _advance(character: Character): number {
    return character.advanceWidth + (character.computedStyle.letterSpacing ?? 0)
  }

  /**
   * Break a paragraph's characters into visual lines.
   * v1: `word-break: break-all` (break before any character that would overflow)
   * plus explicit `\n`/`\r` hard breaks. The newline itself occupies no line box.
   */
  protected _breakLines(paragraph: Paragraph, avail: number): Character[][] {
    const lines: Character[][] = []
    let current: Character[] = []
    let width = 0
    const flush = (): void => {
      lines.push(current)
      current = []
      width = 0
    }
    for (const fragment of paragraph.fragments) {
      for (const c of fragment.characters) {
        if (c.content === '\n' || c.content === '\r') {
          flush()
          continue
        }
        if (avail !== Infinity && current.length > 0 && width + c.advanceWidth > avail) {
          flush()
        }
        current.push(c)
        width += this._advance(c)
      }
    }
    flush()
    return lines
  }

  protected _unionInto(target: BoundingBox, boxes: BoundingBox[]): void {
    const used = boxes.filter(b => b.width !== 0 || b.height !== 0)
    if (!used.length) {
      return
    }
    const u = BoundingBox.from(...used)
    target.left = u.left
    target.top = u.top
    target.width = u.width
    target.height = u.height
  }

  protected _shiftAll(paragraphs: Paragraph[], dy: number): void {
    for (const paragraph of paragraphs) {
      paragraph.lineBox.top += dy
      for (const fragment of paragraph.fragments) {
        fragment.inlineBox.top += dy
        for (const character of fragment.characters) {
          character.inlineBox.top += dy
          character.lineBox.top += dy
        }
      }
    }
  }

  dispose(): void {
    // no-op: nothing is mounted.
  }
}
