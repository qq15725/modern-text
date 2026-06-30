import type { FontLoadedResult } from 'modern-font'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Fonts, parseFont } from 'modern-font'
import { beforeAll, describe, expect, it } from 'vitest'
import { Text } from '../src/Text'

// Incremental layout (Text.incrementalLayout) must produce byte-identical results to a
// full (non-incremental) measure of the same final content — across edit / insert / delete /
// reflow / sequential-typing. This is the correctness gate for the line/paragraph reuse path.

const dir = fileURLToPath(new URL('.', import.meta.url))
let fonts: Fonts

function loadFont(file: string, family: string): FontLoadedResult {
  const buf = readFileSync(resolve(dir, `../docs/public/${file}`))
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
  const font = parseFont(ab) as any
  return {
    src: '',
    family,
    familySet: new Set([family]),
    buffer: ab,
    getFont: () => font,
    getSFNT: () => font.sfnt,
  } as unknown as FontLoadedResult
}

beforeAll(() => {
  const arial = loadFont('Arial.woff', 'Arial')
  const fallback = loadFont('fallback.woff', 'Fallback')
  fonts = new Fonts()
  fonts.set('Arial', arial)
  fonts.set('Fallback', fallback)
  fonts.setFallbackFont(fallback)
})

const STYLE = { fontFamily: 'Arial', fontSize: 14, lineHeight: 1.6, width: 180 }
const content = (lines: string[]): any => lines.map(l => ({ fragments: [{ content: l }] }))

function snapshot(t: Text): number[] {
  const nums: number[] = []
  const r = (x: number): number => Math.round(x * 1000) / 1000
  for (const p of t.paragraphs) {
    for (const f of p.fragments) {
      for (const c of f.characters) {
        const g = c.glyphBox
        nums.push(
          r(c.inlineBox.left), r(c.inlineBox.top), r(c.inlineBox.width), r(c.inlineBox.height),
          r(c.lineBox.left), r(c.lineBox.top), r(c.lineBox.width), r(c.lineBox.height),
          g ? r(g.left) : -1, g ? r(g.top) : -1, g ? r(g.width) : -1, g ? r(g.height) : -1,
        )
      }
    }
  }
  nums.push(r(t.boundingBox.width), r(t.boundingBox.height))
  nums.push(r(t.glyphBox.left), r(t.glyphBox.top), r(t.glyphBox.width), r(t.glyphBox.height))
  return nums
}

// Edit `initial` → `final` incrementally; compare to a fresh full measure of `final`.
function assertEquivalent(initial: string[], final: string[]): void {
  const inc = new Text({ fonts, content: content(initial), style: STYLE }).update() as unknown as Text
  inc.content = content(final) as any
  inc.update()

  const full = new Text({ fonts, content: content(final), style: STYLE }) as unknown as Text
  full.incrementalLayout = false
  full.update()

  expect(snapshot(inc)).toEqual(snapshot(full))
}

const base = ['第一段中文文字内容比较长会换行', '第二段 second line', '第三段 third paragraph', '第四段 fourth']

describe('incremental layout ≡ full layout', () => {
  it('edit a paragraph without changing its line count', () => {
    const e = [...base]
    e[1] = '第二段 SECOND xine'
    assertEquivalent(base, e)
  })

  it('edit a paragraph that adds a wrapped line (shifts following paragraphs)', () => {
    const e = [...base]
    e[0] = '第一段中文文字内容比较长会换行而且现在更长了需要更多行来容纳新增文字'
    assertEquivalent(base, e)
  })

  it('insert a paragraph in the middle', () => {
    assertEquivalent(base, [base[0], base[1], '新插入的一段', base[2], base[3]])
  })

  it('delete a paragraph', () => {
    assertEquivalent(base, [base[0], base[2], base[3]])
  })

  it('append a trailing empty line (trailing newline)', () => {
    assertEquivalent(base, [...base, ''])
  })

  it('sequential typing on the last paragraph', () => {
    const inc = new Text({ fonts, content: content(base), style: STYLE }).update() as unknown as Text
    let last = base[3]
    for (const ch of '增加文字ABC ') {
      last += ch
      const e = [...base]
      e[3] = last
      inc.content = content(e) as any
      inc.update()
    }
    const finalLines = [...base]
    finalLines[3] = last
    const full = new Text({ fonts, content: content(finalLines), style: STYLE }) as unknown as Text
    full.incrementalLayout = false
    full.update()
    expect(snapshot(inc)).toEqual(snapshot(full))
  })

  it('reuse leaves no stale boxes after a no-op re-measure', () => {
    const t = new Text({ fonts, content: content(base), style: STYLE }).update() as unknown as Text
    const a = snapshot(t)
    t.update() // all paragraphs clean, dy = 0
    expect(snapshot(t)).toEqual(a)
  })
})
