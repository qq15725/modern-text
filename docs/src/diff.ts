import { fonts } from 'modern-font'
import { Text } from '../../src'
import { registerDeformations } from '../../src/deformations'

registerDeformations()

interface CharBox { content: string, left: number, top: number, width: number, height: number }
interface FixtureDiff {
  file: string
  count: number
  maxLeft: number
  maxTop: number
  maxWidth: number
  maxHeight: number
  worst: { content: string, dom: CharBox, font: CharBox } | null
  error?: string
}

async function loadFonts(): Promise<void> {
  await fonts.loadFallbackFont({ family: 'Fallback', src: '/fallback.woff' })
  await fonts.load({ family: 'AaHouDiHei', src: '/AaHouDiHei.woff' })
  await fonts.load({ family: 'Slidefu', src: '/Slidefu.woff' })
  await fonts.load({ family: 'Arial', src: '/Arial.woff' })
  await fonts.load({ family: 'LogoSCUnboundedSans-Regular', src: '/LogoSCUnboundedSans-Regular.woff' })
}

function collect(text: Text): CharBox[] {
  return text.characters.map(c => ({
    content: c.content,
    left: c.inlineBox.left,
    top: c.inlineBox.top,
    width: c.inlineBox.width,
    height: c.inlineBox.height,
  }))
}

async function build(fixture: any, useFont: boolean): Promise<Text> {
  const text = new Text({
    fonts,
    // explicit per side — Text auto-selects FontMeasurer when fonts exist
    measurer: useFont ? 'font' : 'dom',
    ...fixture,
  })
  await text.load()
  text.update()
  return text
}

async function run(): Promise<void> {
  await loadFonts()
  const out = document.getElementById('out')!
  const results: FixtureDiff[] = []

  const fixtureMap: Record<string, any> = {}
  for (const [key, importJson] of Object.entries(import.meta.glob('../../test/fixtures/*.json'))) {
    fixtureMap[key.split('/').pop()!] = await (importJson as () => Promise<any>)().then(m => m.default)
  }
  // DOM-only geometry probe (works for vertical, where FontMeasurer may not yet
  // render). Dumps inlineBox + lineBox + advance metrics per character.
  ;(window as any).__geom__ = async (file: string, vertical = false, useFont = false): Promise<any> => {
    const fixture = fixtureMap[file]
    const opts = vertical
      ? { ...fixture, style: { ...fixture.style, writingMode: 'vertical-rl' } }
      : fixture
    const text = await build(opts, useFont)
    const r2 = (n: number): number => +n.toFixed(2)
    return {
      style: opts.style,
      bbox: [r2(text.boundingBox.width), r2(text.boundingBox.height)],
      rows: text.characters.slice(0, 8).map(c => ({
        c: c.content,
        ib: [r2(c.inlineBox.left), r2(c.inlineBox.top), r2(c.inlineBox.width), r2(c.inlineBox.height)],
        lb: [r2(c.lineBox.left), r2(c.lineBox.top), r2(c.lineBox.width), r2(c.lineBox.height)],
        aw: r2(c.advanceWidth),
        ah: r2(c.advanceHeight),
        fh: r2(c.fontHeight),
      })),
    }
  }
  ;(window as any).__probe__ = async (file: string): Promise<any> => {
    const fixture = fixtureMap[file]
    const dom = collect(await build(fixture, false))
    const font = collect(await build(fixture, true))
    const n = Math.min(dom.length, font.length)
    const rows = []
    for (let i = 0; i < n; i++) {
      rows.push({
        c: dom[i].content,
        domL: +dom[i].left.toFixed(2),
        fontL: +font[i].left.toFixed(2),
        dL: +(dom[i].left - font[i].left).toFixed(2),
        domW: +dom[i].width.toFixed(2),
        fontW: +font[i].width.toFixed(2),
        dW: +(dom[i].width - font[i].width).toFixed(2),
        domT: +dom[i].top.toFixed(2),
        fontT: +font[i].top.toFixed(2),
        domH: +dom[i].height.toFixed(2),
        fontH: +font[i].height.toFixed(2),
      })
    }
    return { style: fixture.style, content: fixture.content, rows }
  }

  const diffInto = async (label: string, opts: any): Promise<void> => {
    try {
      const dom = collect(await build(opts, false))
      const font = collect(await build(opts, true))
      const n = Math.min(dom.length, font.length)
      let maxLeft = 0
      let maxTop = 0
      let maxWidth = 0
      let maxHeight = 0
      let worst: FixtureDiff['worst'] = null
      let worstScore = -1
      for (let i = 0; i < n; i++) {
        const dL = Math.abs(dom[i].left - font[i].left)
        const dT = Math.abs(dom[i].top - font[i].top)
        const dW = Math.abs(dom[i].width - font[i].width)
        const dH = Math.abs(dom[i].height - font[i].height)
        maxLeft = Math.max(maxLeft, dL)
        maxTop = Math.max(maxTop, dT)
        maxWidth = Math.max(maxWidth, dW)
        maxHeight = Math.max(maxHeight, dH)
        const score = Math.max(dL, dT)
        if (score > worstScore) {
          worstScore = score
          worst = { content: dom[i].content, dom: dom[i], font: font[i] }
        }
      }
      results.push({ file: label, count: n, maxLeft, maxTop, maxWidth, maxHeight, worst })
    }
    catch (err: any) {
      results.push({ file: label, count: 0, maxLeft: 0, maxTop: 0, maxWidth: 0, maxHeight: 0, worst: null, error: String(err?.message ?? err) })
    }
  }

  for (const [key, importJson] of Object.entries(import.meta.glob('../../test/fixtures/*.json'))) {
    const file = key.split('/').pop()!
    const fixture = await (importJson as () => Promise<any>)().then(m => m.default)
    await diffInto(file, fixture)
    await diffInto(`${file} [V]`, { ...fixture, style: { ...fixture.style, writingMode: 'vertical-rl' } })
  }

  results.sort((a, b) => Math.max(b.maxLeft, b.maxTop) - Math.max(a.maxLeft, a.maxTop))
  ;(window as any).__diffResult__ = results

  const r = (n: number): string => n.toFixed(2).padStart(8)
  const header = `${'fixture'.padEnd(42)}${'n'.padStart(4)}${'Δleft'.padStart(8)}${'Δtop'.padStart(8)}${'Δw'.padStart(8)}${'Δh'.padStart(8)}  worst`
  const rows = results.map((d) => {
    if (d.error)
      return `${d.file.padEnd(42)}  ERROR: ${d.error}`
    const w = d.worst
      ? `'${d.worst.content}' dom(${d.worst.dom.left.toFixed(1)},${d.worst.dom.top.toFixed(1)}) font(${d.worst.font.left.toFixed(1)},${d.worst.font.top.toFixed(1)})`
      : ''
    return `${d.file.padEnd(42)}${String(d.count).padStart(4)}${r(d.maxLeft)}${r(d.maxTop)}${r(d.maxWidth)}${r(d.maxHeight)}  ${w}`
  })
  out.textContent = `${header}\n${'-'.repeat(header.length)}\n${rows.join('\n')}\n\n(window.__diffResult__ has the full data)`
}

run().catch((e) => {
  document.getElementById('out')!.textContent = `FATAL: ${e?.stack ?? e}`
})
