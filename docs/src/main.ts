import { fonts, Text } from '../../src'

// @ts-expect-error import.meta.glob
const fixtures = import.meta.glob('../../test/fixtures/*.json')

async function loadFallbackFont(): Promise<void> {
  fonts.fallbackFont = await fonts.load({ family: '_fallback', url: '/fallback.woff' })
}

function loadFixture(fixture: Record<string, any>): void {
  const text = new Text(fixture as any)
  const view = document.createElement('canvas')
  text.render({ view, pixelRatio: 2 })
  console.warn(text, text.measure())
  document.body.append(view)
}

window.onload = async () => {
  await loadFallbackFont()
  for (const importJson of Object.values(fixtures)) {
    const fixture = await (importJson as () => Promise<any>)().then(rep => rep.default)
    loadFixture(fixture)
  }
}
