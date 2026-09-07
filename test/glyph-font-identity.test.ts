import type { FontLoadedResult } from 'modern-font'
import { readFileSync } from 'node:fs'
import { Fonts, parseFont } from 'modern-font'
import { describe, expect, it } from 'vitest'
import { Text } from '../src/Text'

function font(file: string, family: string): FontLoadedResult {
  const bytes = readFileSync(new URL(`../docs/public/${file}`, import.meta.url))
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
  const parsed = parseFont(buffer) as any
  return {
    src: `${family}/${file}`,
    family,
    familySet: new Set([family]),
    buffer,
    getFont: () => parsed,
    getSFNT: () => parsed.sfnt,
  }
}

function text(fonts: Fonts, content = 'A', family = 'Delayed'): Text {
  return new Text({ fonts, content, style: { fontFamily: family, fontSize: 20 } }).update()
}

describe('字形的实际字体身份', () => {
  it('延迟加载后改变身份，同一已加载字体跨文本复用身份', () => {
    const fonts = new Fonts()
    fonts.setFallbackFont(font('fallback.woff', 'Fallback'))
    const before = text(fonts).characters[0]!.glyphFontId

    fonts.set('Delayed', font('Arial.woff', 'Delayed'))
    const after = text(fonts).characters[0]!.glyphFontId

    expect(before).toBeGreaterThan(0)
    expect(after).not.toBe(before)
    expect(text(fonts).characters[0]!.glyphFontId).toBe(after)
  })

  it('缺字时使用回退字体身份，回退字体替换后不会沿用旧身份', () => {
    const fonts = new Fonts()
    fonts.set('Delayed', font('Arial.woff', 'Delayed'))
    fonts.setFallbackFont(font('fallback.woff', 'Fallback'))
    const before = text(fonts, '中').characters[0]!.glyphFontId

    expect(before).toBe(text(fonts, '中', 'Fallback').characters[0]!.glyphFontId)
    expect(before).not.toBe(text(fonts).characters[0]!.glyphFontId)
    fonts.setFallbackFont(font('fallback.woff', 'Replacement'))
    expect(text(fonts, '中').characters[0]!.glyphFontId).not.toBe(before)
  })

  it('不同字体库中的同名字体不共用身份', () => {
    const a = new Fonts()
    const b = new Fonts()
    a.set('Delayed', font('Arial.woff', 'Delayed'))
    b.set('Delayed', font('fallback.woff', 'Delayed'))

    expect(text(a).characters[0]!.glyphFontId).not.toBe(text(b).characters[0]!.glyphFontId)
  })
})
