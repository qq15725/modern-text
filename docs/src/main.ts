import { measureText, renderText } from '../../src'
const fixtures = import.meta.glob('../../test/fixtures/*.json')

window.onload = async () => {
  // await document.fonts.values().next().value.load()
  // const fixture = {
  //   content: [
  //     [
  //       {
  //         content: '清明雨纷纷，祭祖心切切，',
  //       },
  //     ],
  //     [
  //       {
  //         content: '焚烧烟袅袅，亡灵遥远远，',
  //       },
  //     ],
  //     [
  //       {
  //         content: '但愿皆美美。',
  //       },
  //     ],
  //   ],
  //   style: {
  //     top: 1436.8480890179003,
  //     left: 22.999999999999982,
  //     width: 418,
  //     height: 792.8274984359741,
  //     fontStyle: 'normal',
  //     right: 389,
  //     bottom: 2068,
  //     opacity: 1,
  //     rotate: 0,
  //     scaleX: 1,
  //     scaleY: 1,
  //     writingMode: 'vertical-rl',
  //     letterSpacing: 22,
  //     textAlign: 'left',
  //     fontSize: 35,
  //     fontFamily: 'SourceHanSerifCN-Regular',
  //     color: 'rgba(27,60,63,255)',
  //     lineHeight: 2.39,
  //     fontWeight: '400',
  //     borderRadius: 0,
  //     textIndent: '',
  //   },
  // }
  // console.log(fixture, measureText(fixture))
  // document.body.append(renderText({ ...fixture, pixelRatio: 2 }))

  for (const importJson of Object.values(fixtures)) {
    const fixture = await importJson().then(rep => rep.default)
    console.log(fixture, measureText(fixture))
    document.body.append(renderText({ ...fixture, pixelRatio: 2 }))
  }
}
