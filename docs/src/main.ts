import { measureText, renderText } from '../../src'
const fixtures = import.meta.glob('../../test/fixtures/*.json')

window.onload = async () => {
  for (const importJson of Object.values(fixtures)) {
    const fixture = await importJson().then(rep => rep.default)
    console.log(fixture, measureText(fixture))
    document.body.append(renderText({ ...fixture, pixelRatio: 2 }))
  }
}
