import type { Options, TextMeasurer } from '../../src'
import { fonts } from 'modern-font'
import { FontMeasurer, Text } from '../../src'
import { registerDeformations } from '../../src/deformations'
import { TextEditor } from '../../src/web-components'
import { webglRender } from './webgl'

TextEditor.register()
registerDeformations()

const useWebgl = false

const sharedOptions: Partial<Options> = {
  // debug: true,
  fonts,
}

type Mode = 'dom' | 'font'
let mode: Mode = 'dom'
const loaded: { name: string, fixture: any }[] = []

async function loadFallbackFont(): Promise<void> {
  await fonts.loadFallbackFont({ family: 'Fallback', src: '/fallback.woff' })
  await fonts.load({ family: 'AaHouDiHei', src: '/AaHouDiHei.woff' })
  await fonts.load({ family: 'Slidefu', src: '/Slidefu.woff' })
  await fonts.load({ family: 'Arial', src: '/Arial.woff' })
  await fonts.load({ family: 'LogoSCUnboundedSans-Regular', src: '/LogoSCUnboundedSans-Regular.woff' })
}

/** DOM `Measurer` (default) in 'dom' mode; pure-JS `FontMeasurer` in 'font' mode. */
function measurerFor(): TextMeasurer | undefined {
  return mode === 'font' ? new FontMeasurer(fonts) : undefined
}

interface Figure { canvas: HTMLCanvasElement, caption: HTMLElement, label: string }

/** Render one fixture into a figure; annotate (instead of crashing) on failure. */
async function renderInto(fig: Figure, options: Options): Promise<void> {
  const { canvas, caption, label } = fig
  caption.textContent = label
  canvas.style.display = ''
  try {
    const text = new Text({ ...options, measurer: measurerFor() })
    text.on('update', () => {
      if (useWebgl) {
        webglRender(text, canvas)
      }
      else {
        text.render({ view: canvas })
      }
    })
    await text.load()
    text.update()
    canvas.ondblclick = () => {
      const editor = document.querySelector('text-editor') as TextEditor
      editor.moveToDom(canvas)
      editor.set(text)
    }
  }
  catch (err) {
    // FontMeasurer v1 doesn't support vertical writing-mode yet.
    const msg = (err as Error)?.message ?? String(err)
    caption.textContent = `${label} — ✗ ${/vertical/i.test(msg) ? 'font 模式暂不支持竖排' : msg}`
    canvas.style.display = 'none'
  }
}

/** Build a labeled card: `<fixture name>` heading + horizontal/vertical canvases. */
function createCard(name: string): { card: HTMLElement, figures: Figure[] } {
  const card = document.createElement('section')
  card.className = 'fixture'

  const title = document.createElement('h3')
  title.textContent = name
  card.append(title)

  const views = document.createElement('div')
  views.className = 'views'
  card.append(views)

  const make = (label: string): Figure => {
    const figure = document.createElement('figure')
    const caption = document.createElement('figcaption')
    const canvas = document.createElement('canvas')
    canvas.dataset.file = name
    figure.append(caption, canvas)
    views.append(figure)
    return { canvas, caption, label }
  }

  return { card, figures: [make('horizontal'), make('vertical-rl')] }
}

async function renderAll(): Promise<void> {
  // Build + render everything off-DOM, then swap in one step — avoids the blank
  // flash and the scroll jump that came from clearing the page first.
  const fragment = document.createDocumentFragment()
  const jobs: Array<() => Promise<void>> = []
  for (const { name, fixture } of loaded) {
    const { card, figures } = createCard(name)
    fragment.append(card)
    jobs.push(() => renderInto(figures[0], { ...sharedOptions, ...fixture }))
    jobs.push(() => renderInto(figures[1], {
      ...sharedOptions,
      ...fixture,
      style: { ...fixture.style, writingMode: 'vertical-rl' },
    }))
  }
  for (const job of jobs) {
    await job()
  }
  document.querySelectorAll('.fixture').forEach(el => el.remove())
  document.body.append(fragment)
}

function createToolbar(): void {
  const bar = document.createElement('div')
  bar.id = 'toolbar'

  const button = document.createElement('button')
  const status = document.createElement('span')
  status.className = 'status'

  const syncLabel = (): void => {
    button.textContent = `测算模式：${mode === 'dom' ? 'DOM（浏览器）' : 'Font（纯 JS）'} — 点击切换`
  }
  syncLabel()

  button.onclick = async () => {
    // Remember which fixture is currently under the toolbar so we can return to
    // it after the re-render (card heights change between modes, so a raw scrollY
    // would land on a different fixture).
    const toolbarHeight = bar.offsetHeight
    const cards = [...document.querySelectorAll<HTMLElement>('.fixture')]
    let anchor = 0
    for (let i = 0; i < cards.length; i++) {
      if (cards[i].getBoundingClientRect().bottom > toolbarHeight + 4) {
        anchor = i
        break
      }
    }

    mode = mode === 'dom' ? 'font' : 'dom'
    syncLabel()
    button.disabled = true
    status.textContent = '重新测算中…'
    await renderAll()
    status.textContent = `已用 ${mode === 'dom' ? 'DOM Measurer' : 'FontMeasurer'} 重新测算`
    button.disabled = false

    const target = document.querySelectorAll<HTMLElement>('.fixture')[anchor]
    if (target) {
      window.scrollTo({ top: Math.max(0, target.offsetTop - toolbarHeight - 8) })
    }
  }

  bar.append(button, status)
  document.body.append(bar)
}

window.onload = async () => {
  await loadFallbackFont()
  for (const [key, importJson] of Object.entries(import.meta.glob('../../test/fixtures/*.json'))) {
    const fixture = await (importJson as () => Promise<any>)().then(rep => rep.default)
    loaded.push({ name: key.split('/').pop() ?? key, fixture })
  }
  createToolbar()
  await renderAll()
}
