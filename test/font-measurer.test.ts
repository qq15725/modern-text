import type { FontLoadedResult } from 'modern-font'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Fonts, parseFont } from 'modern-font'
import { beforeAll, describe, expect, it } from 'vitest'
import { FontMeasurer } from '../src/FontMeasurer'
import { Text } from '../src/Text'

const dir = fileURLToPath(new URL('.', import.meta.url))

let fonts: Fonts

function loadFont(file: string, family: string): FontLoadedResult {
  const buf = readFileSync(resolve(dir, `../docs/public/${file}`))
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
  const font = parseFont(ab)
  const sfnt = (font as any).getSFNT?.() ?? (font as any).createSFNT?.()
  return {
    src: '',
    family,
    familySet: new Set([family]),
    buffer: ab,
    getFont: () => font,
    getSFNT: () => sfnt,
  } as unknown as FontLoadedResult
}

beforeAll(() => {
  // Parse real WOFFs straight from disk — proves the whole measure pipeline runs
  // in Node with no DOM and no browser font loading. Arial covers Latin; the
  // Fallback font carries CJK (Arial has no CJK glyphs → falls back to it).
  const arial = loadFont('Arial.woff', 'Arial')
  const fallback = loadFont('Fallback.woff', 'Fallback')
  fonts = new Fonts()
  fonts.set('Arial', arial)
  fonts.set('Fallback', fallback)
  fonts.setFallbackFont(fallback)
})

function makeText(options: Record<string, any>): Text {
  return new Text({
    fonts,
    measurer: new FontMeasurer(fonts),
    style: { fontFamily: 'Arial', fontSize: 14, ...options.style },
    ...options,
  }).update() as unknown as Text
}

const LH = 14 * 1.2 // default line height (fontSize * lineHeight)

describe('fontMeasurer — horizontal layout (v1)', () => {
  it('lays out a single line left-to-right with positive advances', () => {
    const text = makeText({ content: [['AV']] })
    const chars = text.characters
    expect(chars.map(c => c.content)).toEqual(['A', 'V'])
    // lineBox is the line-height strip at the line top; inlineBox is the font
    // content box (advanceHeight) centered within it — mirrors getClientRects.
    expect(chars[0].lineBox.height).toBeCloseTo(LH, 5)
    expect(chars[0].lineBox.top).toBeCloseTo(0, 5)
    expect(chars[0].inlineBox.height).toBeCloseTo(chars[0].advanceHeight, 5)
    expect(chars[0].inlineBox.top).toBeCloseTo((LH - chars[0].advanceHeight) / 2, 5)
    expect(chars[0].inlineBox.left).toBeCloseTo(0, 5)
    expect(chars[0].inlineBox.width).toBeGreaterThan(0)
    expect(chars[1].inlineBox.left).toBeCloseTo(chars[0].advanceWidth, 5)
    expect(chars[1].inlineBox.left).toBeGreaterThan(chars[0].inlineBox.left)
  })

  it('inlineBox (content box) shares its vertical center with the lineBox strip', () => {
    const chars = makeText({ content: [['Mg']] }).characters
    for (const c of chars) {
      const inlineCenter = c.inlineBox.top + c.inlineBox.height / 2
      const lineCenter = c.lineBox.top + c.lineBox.height / 2
      expect(inlineCenter).toBeCloseTo(lineCenter, 5)
    }
  })

  it('adds letter-spacing (px) between glyphs', () => {
    const base = makeText({ content: [['AV']] }).characters
    const spaced = makeText({ content: [['AV']], style: { letterSpacing: 5 } }).characters
    expect(spaced[1].inlineBox.left).toBeCloseTo(base[0].advanceWidth + 5, 5)
  })

  it('gives spaces a positive advance', () => {
    const chars = makeText({ content: [['a b']] }).characters
    expect(chars.map(c => c.content)).toEqual(['a', ' ', 'b'])
    expect(chars[1].advanceWidth).toBeGreaterThan(0)
    expect(chars[2].inlineBox.left).toBeGreaterThan(chars[1].inlineBox.left)
  })

  it('flows multiple fragments continuously on one line', () => {
    // distinct styles keep them as two fragments (plain strings would be merged)
    const text = makeText({ content: [[{ content: 'Hello', color: '#111' }, { content: 'World', color: '#222' }]] })
    const chars = text.characters
    expect(chars.length).toBe(10)
    expect(text.paragraphs[0].fragments.length).toBe(2)
    // 'W' (first char of fragment 2) sits right after 'o' (last of fragment 1)
    const o = chars[4]
    const w = chars[5]
    expect(w.inlineBox.left).toBeCloseTo(o.inlineBox.left + o.advanceWidth, 5)
    // fragment boxes are the union of their characters
    const [f0, f1] = text.paragraphs[0].fragments
    expect(f1.inlineBox.left).toBeCloseTo(f0.inlineBox.left + f0.inlineBox.width, 4)
  })
})

describe('fontMeasurer — CJK (the primary use case)', () => {
  it('lays out fullwidth CJK glyphs at em-width steps', () => {
    const chars = makeText({ content: [['你好世界']], style: { fontFamily: 'Fallback', fontSize: 20 } }).characters
    expect(chars.length).toBe(4)
    for (let i = 0; i < chars.length; i++) {
      expect(chars[i].advanceWidth).toBeCloseTo(20, 1) // fullwidth
      expect(chars[i].inlineBox.left).toBeCloseTo(i * 20, 1)
    }
  })

  it('falls back to the fallback font for glyphs the family lacks', () => {
    // Arial has no CJK glyphs → should resolve via the fallback (Fallback.woff)
    const chars = makeText({ content: [['你好']], style: { fontFamily: 'Arial', fontSize: 20 } }).characters
    expect(chars[0].advanceWidth).toBeCloseTo(20, 1)
    expect(chars[1].inlineBox.left).toBeCloseTo(chars[0].advanceWidth, 1)
  })

  it('keeps mixed CJK + Latin monotonic and non-overlapping', () => {
    const chars = makeText({ content: [['a你b好']], style: { fontFamily: 'Fallback', fontSize: 20 } }).characters
    for (let i = 1; i < chars.length; i++) {
      expect(chars[i].inlineBox.left).toBeGreaterThanOrEqual(
        chars[i - 1].inlineBox.left + chars[i - 1].advanceWidth - 1e-6,
      )
    }
  })
})

describe('fontMeasurer — paragraphs, newlines and empties', () => {
  it('stacks paragraphs vertically by line height', () => {
    const text = makeText({ content: [['Aa'], ['Bb']] })
    const p0 = text.paragraphs[0].fragments[0].characters[0]
    const p1 = text.paragraphs[1].fragments[0].characters[0]
    expect(p0.lineBox.top).toBeCloseTo(0, 5)
    expect(p1.lineBox.top).toBeCloseTo(LH, 5)
  })

  it('treats an explicit \\n as a paragraph break (normalizeText splits it)', () => {
    const text = makeText({ content: [['Aa', '\n', 'Bb']] })
    expect(text.paragraphs.length).toBe(2)
    const tops = new Set(text.characters.map(c => Math.round(c.lineBox.top)))
    expect(tops).toEqual(new Set([0, Math.round(LH)]))
  })

  it('drops an interior empty paragraph (normalizeText removes it)', () => {
    const text = makeText({ content: [['A'], [''], ['B']] })
    expect(text.paragraphs.length).toBe(2)
    expect(text.characters.map(c => c.content)).toEqual(['A', 'B'])
    const b = text.paragraphs[1].fragments[0].characters[0]
    expect(b.lineBox.top).toBeCloseTo(LH, 5)
  })

  it('handles empty content without throwing and reserves one line', () => {
    const text = makeText({ content: [['']] })
    expect(text.characters.length).toBe(0)
    // the lone empty paragraph still occupies one line of height
    expect(text.paragraphs[0].lineBox.height).toBeCloseTo(LH, 5)
  })

  it('keeps a trailing newline as a trailing empty line', () => {
    const text = makeText({ content: [['A', '\n']] })
    expect(text.paragraphs.length).toBe(2)
    expect(text.boundingBox.height).toBeCloseTo(2 * LH, 5)
  })
})

describe('fontMeasurer — box model, alignment, wrapping', () => {
  it('shifts the content origin by root padding', () => {
    const chars = makeText({ content: [['A']], style: { padding: 10 } }).characters
    expect(chars[0].lineBox.left).toBeCloseTo(10, 5)
    expect(chars[0].lineBox.top).toBeCloseTo(10, 5)
  })

  it('adds paragraph margin as vertical gap', () => {
    const text = makeText({ content: [{ content: 'A' }, { content: 'B', marginTop: 10 }] })
    const b = text.paragraphs[1].fragments[0].characters[0]
    expect(b.lineBox.top).toBeCloseTo(LH + 10, 5)
  })

  it('raises the line height to the tallest fragment on the line', () => {
    // a small + a 28px fragment on line 1, then a normal paragraph on line 2.
    const text = makeText({ content: [[{ content: 'a' }, { content: 'B', fontSize: 28 }], ['c']] })
    const tallLine = 28 * 1.2
    const a = text.characters[0]
    // per-character lineBox keeps its OWN font height...
    expect(a.lineBox.height).toBeCloseTo(LH, 5)
    // ...but the small glyph is centered within the tall (max) line box,
    // and the next paragraph starts below that tall line.
    expect(a.inlineBox.top + a.inlineBox.height / 2).toBeCloseTo(tallLine / 2, 4)
    const c = text.paragraphs[1].fragments[0].characters[0]
    expect(c.lineBox.top).toBeCloseTo(tallLine, 5)
  })

  it('wraps with break-all when an explicit width is set', () => {
    const wide = makeText({ content: [['AAAAAAAA']] })
    const narrow = makeText({ content: [['AAAAAAAA']], style: { width: 30 } })
    expect(new Set(wide.characters.map(c => Math.round(c.lineBox.top))).size).toBe(1)
    expect(new Set(narrow.characters.map(c => Math.round(c.lineBox.top))).size).toBeGreaterThan(1)
    for (const c of narrow.characters) {
      expect(c.inlineBox.left + c.inlineBox.width).toBeLessThanOrEqual(30 + 0.5)
    }
  })

  it('honors per-line text-align: center', () => {
    const chars = makeText({ content: [{ content: 'AV', textAlign: 'center' }], style: { width: 200 } }).characters
    const last = chars[chars.length - 1]
    const lineWidth = last.inlineBox.left + last.inlineBox.width - chars[0].inlineBox.left
    const leftGap = chars[0].inlineBox.left
    const rightGap = 200 - (last.inlineBox.left + last.inlineBox.width)
    expect(leftGap).toBeGreaterThan(0)
    expect(leftGap).toBeCloseTo(rightGap, 4)
    expect(leftGap).toBeCloseTo((200 - lineWidth) / 2, 4)
  })

  it('honors per-line text-align: right (end)', () => {
    const chars = makeText({ content: [{ content: 'AV', textAlign: 'right' }], style: { width: 200 } }).characters
    const last = chars[chars.length - 1]
    expect(last.inlineBox.left + last.inlineBox.width).toBeCloseTo(200, 3)
  })

  it('reports the overall bounding box for a fixed width/height', () => {
    const text = makeText({ content: [['AV']], style: { width: 100, height: 50 } })
    expect(text.boundingBox.width).toBeCloseTo(100, 5)
    expect(text.boundingBox.height).toBeCloseTo(50, 5)
  })

  it('block vertical-align: middle centers content within a fixed height', () => {
    const top = makeText({ content: [['A']], style: { height: 100, verticalAlign: 'top' } })
      .characters[0]
      .lineBox
      .top
    const middle = makeText({ content: [['A']], style: { height: 100, verticalAlign: 'middle' } })
      .characters[0]
      .lineBox
      .top
    expect(top).toBeCloseTo(0, 5)
    expect(middle).toBeCloseTo((100 - LH) / 2, 5)
  })
})

describe('fontMeasurer — invariants', () => {
  it('is deterministic across runs', () => {
    const a = makeText({ content: [['Hello']] }).characters.map(c => ({ ...c.inlineBox }))
    const b = makeText({ content: [['Hello']] }).characters.map(c => ({ ...c.inlineBox }))
    expect(a).toEqual(b)
  })

  it('throws on vertical writing-mode (not implemented in v1)', () => {
    expect(() => makeText({ content: [['A']], style: { writingMode: 'vertical-rl' } }))
      .toThrow(/vertical/i)
  })
})
