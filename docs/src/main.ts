import { fonts, Text } from '../../src'

async function loadFallbackFont(): Promise<void> {
  fonts.fallbackFont = await fonts.load({ family: '_fallback', url: '/fallback.woff' })
}

function loadFixture(fixture: Record<string, any>): void {
  const view = document.createElement('canvas')
  const text = new Text(fixture as any)
  text.render({ view, pixelRatio: 2 })
  document.body.append(view)
  console.warn(text, text.measure())
}

window.onload = async () => {
  await loadFallbackFont()
  for (const [, importJson] of Object.entries(import.meta.glob('../../test/fixtures/*.json'))) {
    const fixture = await (importJson as () => Promise<any>)().then(rep => rep.default)
    loadFixture(fixture)
  }
}
