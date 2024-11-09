import { fonts, renderText } from '../../src'

async function loadFallbackFont(): Promise<void> {
  fonts.fallbackFont = await fonts.load({ family: '_fallback', url: '/fallback.woff' })
}

window.onload = async () => {
  await loadFallbackFont()
  for (const [key, importJson] of Object.entries(import.meta.glob('../../test/fixtures/*.json'))) {
    const fixture = await (importJson as () => Promise<any>)().then(rep => rep.default)
    const view = document.createElement('canvas')
    view.dataset.file = key
    const text = renderText({ view, pixelRatio: 2, ...fixture })
    document.body.append(view)
    console.warn(text, text.measure())
  }
}
