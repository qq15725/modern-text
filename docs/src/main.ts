import type { Options } from '../../src'
import { fonts } from 'modern-font'
import { Text } from '../../src'
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
    // if (!key.endsWith('background2.json')) {
    //   continue
    // }

    const fixture = await (importJson as () => Promise<any>)().then(rep => rep.default)

    // horizontal
    const view1 = document.createElement('canvas')
    view1.dataset.file = key
    const text1 = new Text({
      ...sharedOptions,
      ...fixture,
    })
    text1.on('update', (ev) => {
      text1.render({ view: view1 })
      // webglRender(text1, view1)
    })
    await text1.load()
    text1.update()
    document.body.append(view1)
    view1.addEventListener('dblclick', () => {
      const textEditor = document.querySelector('text-editor') as TextEditor
      textEditor.left = view1.offsetLeft
      textEditor.top = view1.offsetTop
      textEditor.set(text1)
    })

    // vertical
    const view2 = document.createElement('canvas')
    view2.dataset.file = key
    const text2 = new Text({
      ...sharedOptions,
      ...fixture,
      style: { ...fixture.style, writingMode: 'vertical-lr' },
      view: view2,
      load: true,
    })
    text2.on('update', (ev) => {
      text2.render({ view: view2 })
      // webglRender(text2, view1)
    })
    await text2.load()
    text2.update()
    document.body.append(view2)
    view2.addEventListener('dblclick', () => {
      const textEditor = document.querySelector('text-editor') as TextEditor
      textEditor.left = view2.offsetLeft
      textEditor.top = view2.offsetTop
      textEditor.set(text2)
    })
  }
}
