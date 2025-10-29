import type { Options } from '../../src'
import { fonts } from 'modern-font'
import { renderText, Text } from '../../src'
import { TextEditor } from '../../src/web-components'

TextEditor.register()

const sharedOptions: Partial<Options> = {
  // debug: true,
  fonts,
}

async function loadFallbackFont(): Promise<void> {
  await fonts.loadFallbackFont({ family: 'Fallback', src: '/fallback.woff' })
  await fonts.load({ family: 'AaHouDiHei', src: '/AaHouDiHei.woff' })
  await fonts.load({ family: 'Slidefu', src: '/Slidefu.woff' })
  await fonts.load({ family: 'Arial', src: '/Arial.woff' })
}

window.onload = async () => {
  await loadFallbackFont()
  for (const [key, importJson] of Object.entries(import.meta.glob('../../test/fixtures/*.json'))) {
    // if (!key.endsWith('emoji.json')) {
    //   continue
    // }

    const fixture = await (importJson as () => Promise<any>)().then(rep => rep.default)

    // horizontal
    const view1 = document.createElement('canvas')
    view1.dataset.file = key
    const options = { ...sharedOptions, ...fixture }

    // text
    const text = new Text(options)
    text.on('update', (ev) => {
      text.render({ view: view1 })
      // webglRender(text, view1)
    })
    text.on('render', ev => console.warn(ev))
    text.on('measure', ev => console.warn(ev))
    await text.load()
    text.update()
    document.body.append(view1)

    // editor
    view1.addEventListener('dblclick', () => {
      const textEditor = document.querySelector('text-editor') as TextEditor
      textEditor.left = view1.offsetLeft
      textEditor.top = view1.offsetTop
      textEditor.set(text)
    })

    // vertical
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
