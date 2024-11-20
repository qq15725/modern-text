import type { TextOptions } from '../../src'
import { fonts } from 'modern-font'
import { renderText } from '../../src'

const sharedOptions: Partial<TextOptions> = {
  // debug: true,
  fonts,
  pixelRatio: 2,
}

async function loadFallbackFont(): Promise<void> {
  fonts.fallbackFont = await fonts.load({ family: 'fallbackFont', src: '/fallback.woff' })
  await fonts.load({ family: 'AaHouDiHei', src: '/AaHouDiHei.woff' })
}

window.onload = async () => {
  await loadFallbackFont()
  for (const [key, importJson] of Object.entries(import.meta.glob('../../test/fixtures/*.json'))) {
    // if (!key.endsWith('highlight.2.json')) {
    //   continue
    // }

    const fixture = await (importJson as () => Promise<any>)().then(rep => rep.default)

    // 1
    const view1 = document.createElement('canvas')
    view1.dataset.file = key
    const text = renderText({ ...sharedOptions, ...fixture, view: view1 })
    document.body.append(view1)

    // 2
    const view2 = document.createElement('canvas')
    view2.dataset.file = key
    renderText({ ...sharedOptions, ...fixture, style: { ...fixture.style, writingMode: 'vertical-lr' }, view: view2 })
    document.body.append(view2)

    console.warn(text, text.measure())
  }
}
