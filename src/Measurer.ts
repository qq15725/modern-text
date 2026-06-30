import type { Fonts } from 'modern-font'
import type { FullStyle } from 'modern-idoc'
import type { Character, Paragraph } from './content'
import type { MeasurerResult, TextMeasurer } from './types'
import { fonts as globalFonts } from 'modern-font'
import { BoundingBox } from 'modern-path2d'

type Edge = 'Top' | 'Right' | 'Bottom' | 'Left'

/** Resolve a box-model side: explicit per-side value ?? shorthand ?? 0. */
function side(style: Record<string, any>, name: 'padding' | 'margin', edge: Edge): number {
  return (style[`${name}${edge}`] ?? style[name] ?? 0) as number
}

/**
 * The pure-JS, DOM-free text measurer (the only built-in backend).
 *
 * It computes the four-level boxes (`character.inlineBox`/`lineBox`, `fragment.inlineBox`,
 * `paragraph.lineBox`) directly from `modern-font` glyph advances + kerning — no DOM, so it
 * runs in Node/SSR/Worker and measures the *exact* font that is rendered (advances come from
 * the same SFNT the glyph paths do, so layout and rendering are pixel-consistent by construction).
 *
 * ## Scope
 * - `horizontal-tb` (LTR) and `vertical-rl` (columns right-to-left, glyphs top↓)
 * - line breaking: `word-break: break-all` (greedy, break anywhere) + explicit `\n`
 * - per-line `text-align` (start/left/center/end/right), `text-indent` (first line)
 * - box model: root + paragraph `padding`/`margin` (horizontal), `letter-spacing`,
 *   `line-height`; block `vertical-align` (top/middle/bottom) at fixed height
 * - pair kerning (GPOS `kern` feature / legacy `kern` table) folded into break + positioning
 *
 * ## Not yet implemented (TODO)
 * - UAX#14 `word-break: normal` + 避头尾/kinsoku (`line-break`)
 * - BiDi, per-fragment inline `vertical-align`, borders
 * - vertical: per-paragraph margin/padding and block alignment
 * - ligatures (GSUB) — fine for CJK and most UI Latin
 *
 * Coordinates are relative to the root border-box top-left.
 */
export class Measurer implements TextMeasurer {
  measure(
    paragraphs: Paragraph[],
    rootStyle: FullStyle,
    _dom?: HTMLElement,
    fonts?: Fonts,
  ): MeasurerResult {
    // `fonts` is supplied by Text.measure(); fall back to the global registry
    // for standalone use.
    const _fonts = fonts ?? globalFonts

    // Glyph advances/metrics must be known before placement.
    // 增量：未变段落（_layoutDirty=false）的字形度量已在上次测量得出，跳过。
    for (const paragraph of paragraphs) {
      if (!paragraph._layoutDirty) {
        continue
      }
      for (const fragment of paragraph.fragments) {
        for (const character of fragment.characters) {
          character.measureGlyph(_fonts)
        }
      }
    }

    // 横排：填充相邻字形的字偶距（kerning）。竖排不适用横向 kern，保持 0。
    if (!rootStyle.writingMode.includes('vertical')) {
      this._applyKerning(paragraphs)
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

  protected _measureHorizontal(paragraphs: Paragraph[], rootStyle: FullStyle): MeasurerResult {
    const rootPad = this._rootPadding(rootStyle)
    // border-box: the content area excludes padding.
    // textWrap: 'nowrap' → don't break by width (availWidth = Infinity), lay text on a single
    // line; the element's `width` is still honored for totalWidth/alignment below. Single-line
    // art text (arc/arch deformations) relies on this so the box can be sized to the deformed
    // glyph width without the smaller width feeding back into line-breaking.
    const hasWidth = typeof rootStyle.width === 'number'
    const noWrap = rootStyle.textWrap === 'nowrap'
    const availWidth = (hasWidth && !noWrap)
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

      if (!paragraph._layoutDirty) {
        // 增量复用：内容/样式未变，整段相对布局不变，只随前序高度变化沿 y 平移 dy。
        const dy = paraTop - paragraph._layoutTop
        if (dy) {
          for (const fragment of paragraph.fragments) {
            for (const c of fragment.characters) {
              c.translateY(dy)
            }
            fragment.inlineBox.top += dy
          }
          paragraph.lineBox.top += dy
          if (paragraph._glyphBox) {
            paragraph._glyphBox.top += dy
          }
        }
        paragraph._layoutTop = paraTop
        paraRight = paragraph._layoutRight
        y = paraTop + paragraph.lineBox.height
        if (paraRight > maxRight) {
          maxRight = paraRight
        }
        y += pBottom + mBottom
        continue
      }

      const lines = this._breakLines(paragraph, liAvail)
      const align = pStyle.textAlign
      const indent = pStyle.textIndent ?? 0
      let hasChars = false
      let anyAdvance = false

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        const lineIndent = i === 0 ? indent : 0

        // Line-box height = max contribution; an empty line keeps the paragraph's strut.
        let lineHeight = pStyle.fontSize * pStyle.lineHeight
        let contentWidth = 0
        let firstW = true
        for (const c of line) {
          if (c.fontHeight > lineHeight) {
            lineHeight = c.fontHeight
          }
          if (!firstW) {
            contentWidth += c.kerningBefore
          }
          firstW = false
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

        let firstInLine = true
        for (const c of line) {
          hasChars = true
          if (c.advanceWidth > 0) {
            anyAdvance = true
          }
          // 行内非首字：放置前推进字偶距（与断行/宽度计算口径一致）。
          if (!firstInLine) {
            x += c.kerningBefore
          }
          firstInLine = false
          const adv = c.advanceWidth
          const contentHeight = c.advanceHeight // font content box (ascent+descent)
          // inlineBox mirrors the browser's per-character client rect: the font
          // content box, vertically centered within the line box. (getClientRects
          // returns the content box — ascent+descent — not the full line box.)
          // lineBox (the line-height strip) is derived from inlineBox on read — see Character.
          c.inlineBox.left = x
          c.inlineBox.top = y + (lineHeight - contentHeight) / 2
          c.inlineBox.width = adv
          c.inlineBox.height = contentHeight
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
      // 缓存本段绝对布局，供下次增量复用时平移/并集。
      paragraph._layoutTop = paraTop
      paragraph._layoutHeight = paragraph.lineBox.height
      paragraph._layoutRight = paraRight
      paragraph._glyphBox = undefined // 由 Text.measure 的 getGlyphBox 重新填充。
      // 退化测量（有字符但字形 advance 全为 0 → 字体未就绪）不作为可复用基准。
      paragraph._layoutValid = !hasChars || anyAdvance

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
   * `advanceHeight`, and the column thickness is `fontHeight`. The lineBox stays
   * accurate even though inlineBox carries the content-box rounding residual.
   *
   * v1: `vertical-rl` only; no per-paragraph margin/padding or block alignment.
   */
  protected _measureVertical(paragraphs: Paragraph[], rootStyle: FullStyle): MeasurerResult {
    const rootPad = this._rootPadding(rootStyle)
    // textWrap: 'nowrap' → don't break by height in vertical writing mode (single column).
    const hasHeight = typeof rootStyle.height === 'number'
    const noWrap = rootStyle.textWrap === 'nowrap'
    const availHeight = (hasHeight && !noWrap)
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
        c.inlineBox.top = y
        c.inlineBox.height = advance
        c.inlineBox.width = contentWidth
        c.inlineBox.left = colLeft + (column.thickness - contentWidth) / 2
        // lineBox (the column-thickness strip) is derived from inlineBox on read — see Character.
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
        // 行内非首字计入字偶距（kerning）：与浏览器一样按「含 kern 的渲染宽度」断行。
        const kern = current.length > 0 ? c.kerningBefore : 0
        if (avail !== Infinity && current.length > 0 && width + kern + c.advanceWidth > avail) {
          flush()
        }
        if (current.length > 0) {
          width += c.kerningBefore
        }
        current.push(c)
        width += this._advance(c)
      }
    }
    flush()
    return lines
  }

  // 横排：为每段（仅 dirty 段）填充相邻字形的字偶距。clean 段沿用上次结果（kern 是行内水平量，
  // 不随段落 y 平移变化），契合增量布局。
  protected _applyKerning(paragraphs: Paragraph[]): void {
    for (const paragraph of paragraphs) {
      if (!paragraph._layoutDirty) {
        continue
      }
      let prev: Character | undefined
      for (const fragment of paragraph.fragments) {
        for (const c of fragment.characters) {
          c.kerningBefore = c.computeKerningBefore(prev)
          prev = c
        }
      }
    }
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
          // lineBox is derived from inlineBox — no separate shift needed.
        }
      }
    }
  }

  dispose(): void {
    // no-op: nothing is mounted.
  }
}
