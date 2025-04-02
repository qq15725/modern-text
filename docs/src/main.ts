import type { TextOptions } from '../../src'
import { fonts } from 'modern-font'
import { renderText, Text } from '../../src'

const sharedOptions: Partial<TextOptions> = {
  // debug: true,
  fonts,
}

async function loadFallbackFont(): Promise<void> {
  await fonts.loadFallbackFont({ family: 'Fallback', src: '/fallback.woff' })
  await fonts.load({ family: 'AaHouDiHei', src: '/AaHouDiHei.woff' })
  await fonts.load({ family: 'Slidefu', src: '/Slidefu.woff' })
}

window.onload = async () => {
  await loadFallbackFont()
  for (const [key, importJson] of Object.entries(import.meta.glob('../../test/fixtures/*.json'))) {
    // if (!key.endsWith('emoji.json')) {
    //   continue
    // }

    const fixture = await (importJson as () => Promise<any>)().then(rep => rep.default)

    // 1
    const view1 = document.createElement('canvas')
    view1.dataset.file = key
    const text = new Text({ ...sharedOptions, ...fixture })
    text.on('render', (ev) => {
      console.warn(ev)
    })
    text.on('measure', (ev) => {
      console.warn(ev)
    })
    await text.load()
    text.render({ view: view1 })
    document.body.append(view1)

    // 2
    const view2 = document.createElement('canvas')
    view2.dataset.file = key
    await renderText({
      ...sharedOptions,
      ...fixture,
      style: { ...fixture.style, writingMode: 'vertical-lr' },
      view: view2,
      load: true,
    })
    document.body.append(view2)
  }
}
