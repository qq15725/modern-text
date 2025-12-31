import type { Options } from '../../src'
import { fonts } from 'modern-font'
import { Text } from '../../src'
import { TextEditor } from '../../src/web-components'
import { webglRender } from './webgl'

TextEditor.register()

const useWebgl = false

const sharedOptions: Partial<Options> = {
  // debug: true,
  fonts,
}

async function loadFallbackFont(): Promise<void> {
  await fonts.loadFallbackFont({ family: 'Fallback', src: '/fallback.woff' })
  await fonts.load({ family: 'AaHouDiHei', src: '/AaHouDiHei.woff' })
  await fonts.load({ family: 'Slidefu', src: '/Slidefu.woff' })
  await fonts.load({ family: 'Arial', src: '/Arial.woff' })
  await fonts.load({ family: 'LogoSCUnboundedSans-Regular', src: '/LogoSCUnboundedSans-Regular.woff' })
}
// 活动回顾

window.onload = async () => {
  await loadFallbackFont()
  for (const [key, importJson] of Object.entries(import.meta.glob('../../test/fixtures/*.json'))) {
    // if (!key.endsWith('gl.json')) {
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
    text1.on('update', () => {
      if (useWebgl) {
        webglRender(text1, view1)
      }
      else {
        text1.render({ view: view1 })
      }
    })
    await text1.load()
    text1.update()
    document.body.append(view1)
    view1.addEventListener('dblclick', () => {
      const textEditor = document.querySelector('text-editor') as TextEditor
      textEditor.moveToDom(view1)
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
    text2.on('update', () => {
      if (useWebgl) {
        webglRender(text2, view2)
      }
      else {
        text2.render({ view: view2 })
      }
    })
    await text2.load()
    text2.update()
    document.body.append(view2)
    view2.addEventListener('dblclick', () => {
      const textEditor = document.querySelector('text-editor') as TextEditor
      textEditor.moveToDom(view2)
      textEditor.set(text2)
    })
  }
}
