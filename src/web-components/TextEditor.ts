import type { FragmentObject, NormalizedTextContent, ParagraphObject } from 'modern-idoc'
import type { Character } from '../content'
import type { TextOptions } from '../types'
import { diffChars } from 'diff'
import { isCRLF, normalizeCRLF, normalizeTextContent, textContentToString } from 'modern-idoc'
import { Text } from '../Text'

export interface SelectableCharacter {
  color: string
  left: number
  top: number
  width: number
  height: number
  content: string
  isFirst?: boolean
  isLast?: boolean
  isLastSelected?: boolean
  isCrlf?: boolean
}

function normalizeStyle(style: Record<string, any>): Record<string, any> {
  const newStyle: Record<string, any> = {}
  for (const key in style) {
    if (key !== 'id' && style[key] !== undefined && style[key] !== '') {
      newStyle[key] = style[key]
    }
  }
  return newStyle
}

function contentsToCharStyles(contents: NormalizedTextContent): Record<string, any>[] {
  return contents.flatMap((p) => {
    const res = p.fragments.flatMap((f) => {
      const { content, ...style } = f
      return Array.from(normalizeCRLF(content)).map(() => ({ ...style }))
    })
    if (isCRLF(normalizeCRLF(p.fragments[p.fragments.length - 1]?.content ?? ''))) {
      return res
    }
    return [...res, {}]
  })
}

function isEqualStyle(style1: Record<string, any>, style2: Record<string, any>): boolean {
  const keys1 = Object.keys(style1)
  const keys2 = Object.keys(style2)
  const keys = Array.from(new Set([...keys1, ...keys2]))
  return !keys.length || keys.every(key => style1[key] === style2[key])
}

const emojiRE
  = /[#*0-9]\uFE0F?\u20E3|[\xA9\xAE\u203C\u2049\u2122\u2139\u2194-\u2199\u21A9\u21AA\u231A\u231B\u2328\u23CF\u23ED-\u23EF\u23F1\u23F2\u23F8-\u23FA\u24C2\u25AA\u25AB\u25B6\u25C0\u25FB\u25FC\u25FE\u2600-\u2604\u260E\u2611\u2614\u2615\u2618\u2620\u2622\u2623\u2626\u262A\u262E\u262F\u2638-\u263A\u2640\u2642\u2648-\u2653\u265F\u2660\u2663\u2665\u2666\u2668\u267B\u267E\u267F\u2692\u2694-\u2697\u2699\u269B\u269C\u26A0\u26A7\u26AA\u26B0\u26B1\u26BD\u26BE\u26C4\u26C8\u26CF\u26D1\u26E9\u26F0-\u26F5\u26F7\u26F8\u26FA\u2702\u2708\u2709\u270F\u2712\u2714\u2716\u271D\u2721\u2733\u2734\u2744\u2747\u2757\u2763\u27A1\u2934\u2935\u2B05-\u2B07\u2B1B\u2B1C\u2B55\u3030\u303D\u3297\u3299]\uFE0F?|[\u261D\u270C\u270D](?:\uD83C[\uDFFB-\uDFFF]|\uFE0F)?|[\u270A\u270B](?:\uD83C[\uDFFB-\uDFFF])?|[\u23E9-\u23EC\u23F0\u23F3\u25FD\u2693\u26A1\u26AB\u26C5\u26CE\u26D4\u26EA\u26FD\u2705\u2728\u274C\u274E\u2753-\u2755\u2795-\u2797\u27B0\u27BF\u2B50]|\u26D3\uFE0F?(?:\u200D\uD83D\uDCA5)?|\u26F9(?:\uD83C[\uDFFB-\uDFFF]|\uFE0F)?(?:\u200D[\u2640\u2642]\uFE0F?)?|\u2764\uFE0F?(?:\u200D(?:\uD83D\uDD25|\uD83E\uDE79))?|\uD83C(?:[\uDC04\uDD70\uDD71\uDD7E\uDD7F\uDE02\uDE37\uDF21\uDF24-\uDF2C\uDF36\uDF7D\uDF96\uDF97\uDF99-\uDF9B\uDF9E\uDF9F\uDFCD\uDFCE\uDFD4-\uDFDF\uDFF5\uDFF7]\uFE0F?|[\uDF85\uDFC2\uDFC7](?:\uD83C[\uDFFB-\uDFFF])?|[\uDFC4\uDFCA](?:\uD83C[\uDFFB-\uDFFF])?(?:\u200D[\u2640\u2642]\uFE0F?)?|[\uDFCB\uDFCC](?:\uD83C[\uDFFB-\uDFFF]|\uFE0F)?(?:\u200D[\u2640\u2642]\uFE0F?)?|[\uDCCF\uDD8E\uDD91-\uDD9A\uDE01\uDE1A\uDE2F\uDE32-\uDE36\uDE38-\uDE3A\uDE50\uDE51\uDF00-\uDF20\uDF2D-\uDF35\uDF37-\uDF43\uDF45-\uDF4A\uDF4C-\uDF7C\uDF7E-\uDF84\uDF86-\uDF93\uDFA0-\uDFC1\uDFC5\uDFC6\uDFC8\uDFC9\uDFCF-\uDFD3\uDFE0-\uDFF0\uDFF8-\uDFFF]|\uDDE6\uD83C[\uDDE8-\uDDEC\uDDEE\uDDF1\uDDF2\uDDF4\uDDF6-\uDDFA\uDDFC\uDDFD\uDDFF]|\uDDE7\uD83C[\uDDE6\uDDE7\uDDE9-\uDDEF\uDDF1-\uDDF4\uDDF6-\uDDF9\uDDFB\uDDFC\uDDFE\uDDFF]|\uDDE8\uD83C[\uDDE6\uDDE8\uDDE9\uDDEB-\uDDEE\uDDF0-\uDDF7\uDDFA-\uDDFF]|\uDDE9\uD83C[\uDDEA\uDDEC\uDDEF\uDDF0\uDDF2\uDDF4\uDDFF]|\uDDEA\uD83C[\uDDE6\uDDE8\uDDEA\uDDEC\uDDED\uDDF7-\uDDFA]|\uDDEB\uD83C[\uDDEE-\uDDF0\uDDF2\uDDF4\uDDF7]|\uDDEC\uD83C[\uDDE6\uDDE7\uDDE9-\uDDEE\uDDF1-\uDDF3\uDDF5-\uDDFA\uDDFC\uDDFE]|\uDDED\uD83C[\uDDF0\uDDF2\uDDF3\uDDF7\uDDF9\uDDFA]|\uDDEE\uD83C[\uDDE8-\uDDEA\uDDF1-\uDDF4\uDDF6-\uDDF9]|\uDDEF\uD83C[\uDDEA\uDDF2\uDDF4\uDDF5]|\uDDF0\uD83C[\uDDEA\uDDEC-\uDDEE\uDDF2\uDDF3\uDDF5\uDDF7\uDDFC\uDDFE\uDDFF]|\uDDF1\uD83C[\uDDE6-\uDDE8\uDDEE\uDDF0\uDDF7-\uDDFB\uDDFE]|\uDDF2\uD83C[\uDDE6\uDDE8-\uDDED\uDDF0-\uDDFF]|\uDDF3\uD83C[\uDDE6\uDDE8\uDDEA-\uDDEC\uDDEE\uDDF1\uDDF4\uDDF5\uDDF7\uDDFA\uDDFF]|\uDDF4\uD83C\uDDF2|\uDDF5\uD83C[\uDDE6\uDDEA-\uDDED\uDDF0-\uDDF3\uDDF7-\uDDF9\uDDFC\uDDFE]|\uDDF6\uD83C\uDDE6|\uDDF7\uD83C[\uDDEA\uDDF4\uDDF8\uDDFA\uDDFC]|\uDDF8\uD83C[\uDDE6-\uDDEA\uDDEC-\uDDF4\uDDF7-\uDDF9\uDDFB\uDDFD-\uDDFF]|\uDDF9\uD83C[\uDDE6\uDDE8\uDDE9\uDDEB-\uDDED\uDDEF-\uDDF4\uDDF7\uDDF9\uDDFB\uDDFC\uDDFF]|\uDDFA\uD83C[\uDDE6\uDDEC\uDDF2\uDDF3\uDDF8\uDDFE\uDDFF]|\uDDFB\uD83C[\uDDE6\uDDE8\uDDEA\uDDEC\uDDEE\uDDF3\uDDFA]|\uDDFC\uD83C[\uDDEB\uDDF8]|\uDDFD\uD83C\uDDF0|\uDDFE\uD83C[\uDDEA\uDDF9]|\uDDFF\uD83C[\uDDE6\uDDF2\uDDFC]|\uDF44(?:\u200D\uD83D\uDFEB)?|\uDF4B(?:\u200D\uD83D\uDFE9)?|\uDFC3(?:\uD83C[\uDFFB-\uDFFF])?(?:\u200D(?:[\u2640\u2642]\uFE0F?(?:\u200D\u27A1\uFE0F?)?|\u27A1\uFE0F?))?|\uDFF3\uFE0F?(?:\u200D(?:\u26A7\uFE0F?|\uD83C\uDF08))?|\uDFF4(?:\u200D\u2620\uFE0F?|\uDB40\uDC67\uDB40\uDC62\uDB40(?:\uDC65\uDB40\uDC6E\uDB40\uDC67|\uDC73\uDB40\uDC63\uDB40\uDC74|\uDC77\uDB40\uDC6C\uDB40\uDC73)\uDB40\uDC7F)?)|\uD83D(?:[\uDC3F\uDCFD\uDD49\uDD4A\uDD6F\uDD70\uDD73\uDD76-\uDD79\uDD87\uDD8A-\uDD8D\uDDA5\uDDA8\uDDB1\uDDB2\uDDBC\uDDC2-\uDDC4\uDDD1-\uDDD3\uDDDC-\uDDDE\uDDE1\uDDE3\uDDE8\uDDEF\uDDF3\uDDFA\uDECB\uDECD-\uDECF\uDEE0-\uDEE5\uDEE9\uDEF0\uDEF3]\uFE0F?|[\uDC42\uDC43\uDC46-\uDC50\uDC66\uDC67\uDC6B-\uDC6D\uDC72\uDC74-\uDC76\uDC78\uDC7C\uDC83\uDC85\uDC8F\uDC91\uDCAA\uDD7A\uDD95\uDD96\uDE4C\uDE4F\uDEC0\uDECC](?:\uD83C[\uDFFB-\uDFFF])?|[\uDC6E\uDC70\uDC71\uDC73\uDC77\uDC81\uDC82\uDC86\uDC87\uDE45-\uDE47\uDE4B\uDE4D\uDE4E\uDEA3\uDEB4\uDEB5](?:\uD83C[\uDFFB-\uDFFF])?(?:\u200D[\u2640\u2642]\uFE0F?)?|[\uDD74\uDD90](?:\uD83C[\uDFFB-\uDFFF]|\uFE0F)?|[\uDC00-\uDC07\uDC09-\uDC14\uDC16-\uDC25\uDC27-\uDC3A\uDC3C-\uDC3E\uDC40\uDC44\uDC45\uDC51-\uDC65\uDC6A\uDC79-\uDC7B\uDC7D-\uDC80\uDC84\uDC88-\uDC8E\uDC90\uDC92-\uDCA9\uDCAB-\uDCFC\uDCFF-\uDD3D\uDD4B-\uDD4E\uDD50-\uDD67\uDDA4\uDDFB-\uDE2D\uDE2F-\uDE34\uDE37-\uDE41\uDE43\uDE44\uDE48-\uDE4A\uDE80-\uDEA2\uDEA4-\uDEB3\uDEB7-\uDEBF\uDEC1-\uDEC5\uDED0-\uDED2\uDED5-\uDED7\uDEDC-\uDEDF\uDEEB\uDEEC\uDEF4-\uDEFC\uDFE0-\uDFEB\uDFF0]|\uDC08(?:\u200D\u2B1B)?|\uDC15(?:\u200D\uD83E\uDDBA)?|\uDC26(?:\u200D(?:\u2B1B|\uD83D\uDD25))?|\uDC3B(?:\u200D\u2744\uFE0F?)?|\uDC41\uFE0F?(?:\u200D\uD83D\uDDE8\uFE0F?)?|\uDC68(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D\uD83D(?:\uDC8B\u200D\uD83D)?\uDC68|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D(?:[\uDC68\uDC69]\u200D\uD83D(?:\uDC66(?:\u200D\uD83D\uDC66)?|\uDC67(?:\u200D\uD83D[\uDC66\uDC67])?)|[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uDC66(?:\u200D\uD83D\uDC66)?|\uDC67(?:\u200D\uD83D[\uDC66\uDC67])?)|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]))|\uD83C(?:\uDFFB(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D\uD83D(?:\uDC8B\u200D\uD83D)?\uDC68\uD83C[\uDFFB-\uDFFF]|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]|\uDD1D\u200D\uD83D\uDC68\uD83C[\uDFFC-\uDFFF])))?|\uDFFC(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D\uD83D(?:\uDC8B\u200D\uD83D)?\uDC68\uD83C[\uDFFB-\uDFFF]|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]|\uDD1D\u200D\uD83D\uDC68\uD83C[\uDFFB\uDFFD-\uDFFF])))?|\uDFFD(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D\uD83D(?:\uDC8B\u200D\uD83D)?\uDC68\uD83C[\uDFFB-\uDFFF]|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]|\uDD1D\u200D\uD83D\uDC68\uD83C[\uDFFB\uDFFC\uDFFE\uDFFF])))?|\uDFFE(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D\uD83D(?:\uDC8B\u200D\uD83D)?\uDC68\uD83C[\uDFFB-\uDFFF]|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]|\uDD1D\u200D\uD83D\uDC68\uD83C[\uDFFB-\uDFFD\uDFFF])))?|\uDFFF(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D\uD83D(?:\uDC8B\u200D\uD83D)?\uDC68\uD83C[\uDFFB-\uDFFF]|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]|\uDD1D\u200D\uD83D\uDC68\uD83C[\uDFFB-\uDFFE])))?))?|\uDC69(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D\uD83D(?:\uDC8B\u200D\uD83D)?[\uDC68\uDC69]|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D(?:[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uDC66(?:\u200D\uD83D\uDC66)?|\uDC67(?:\u200D\uD83D[\uDC66\uDC67])?|\uDC69\u200D\uD83D(?:\uDC66(?:\u200D\uD83D\uDC66)?|\uDC67(?:\u200D\uD83D[\uDC66\uDC67])?))|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]))|\uD83C(?:\uDFFB(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D\uD83D(?:[\uDC68\uDC69]|\uDC8B\u200D\uD83D[\uDC68\uDC69])\uD83C[\uDFFB-\uDFFF]|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]|\uDD1D\u200D\uD83D[\uDC68\uDC69]\uD83C[\uDFFC-\uDFFF])))?|\uDFFC(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D\uD83D(?:[\uDC68\uDC69]|\uDC8B\u200D\uD83D[\uDC68\uDC69])\uD83C[\uDFFB-\uDFFF]|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]|\uDD1D\u200D\uD83D[\uDC68\uDC69]\uD83C[\uDFFB\uDFFD-\uDFFF])))?|\uDFFD(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D\uD83D(?:[\uDC68\uDC69]|\uDC8B\u200D\uD83D[\uDC68\uDC69])\uD83C[\uDFFB-\uDFFF]|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]|\uDD1D\u200D\uD83D[\uDC68\uDC69]\uD83C[\uDFFB\uDFFC\uDFFE\uDFFF])))?|\uDFFE(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D\uD83D(?:[\uDC68\uDC69]|\uDC8B\u200D\uD83D[\uDC68\uDC69])\uD83C[\uDFFB-\uDFFF]|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]|\uDD1D\u200D\uD83D[\uDC68\uDC69]\uD83C[\uDFFB-\uDFFD\uDFFF])))?|\uDFFF(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D\uD83D(?:[\uDC68\uDC69]|\uDC8B\u200D\uD83D[\uDC68\uDC69])\uD83C[\uDFFB-\uDFFF]|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]|\uDD1D\u200D\uD83D[\uDC68\uDC69]\uD83C[\uDFFB-\uDFFE])))?))?|\uDC6F(?:\u200D[\u2640\u2642]\uFE0F?)?|\uDD75(?:\uD83C[\uDFFB-\uDFFF]|\uFE0F)?(?:\u200D[\u2640\u2642]\uFE0F?)?|\uDE2E(?:\u200D\uD83D\uDCA8)?|\uDE35(?:\u200D\uD83D\uDCAB)?|\uDE36(?:\u200D\uD83C\uDF2B\uFE0F?)?|\uDE42(?:\u200D[\u2194\u2195]\uFE0F?)?|\uDEB6(?:\uD83C[\uDFFB-\uDFFF])?(?:\u200D(?:[\u2640\u2642]\uFE0F?(?:\u200D\u27A1\uFE0F?)?|\u27A1\uFE0F?))?)|\uD83E(?:[\uDD0C\uDD0F\uDD18-\uDD1F\uDD30-\uDD34\uDD36\uDD77\uDDB5\uDDB6\uDDBB\uDDD2\uDDD3\uDDD5\uDEC3-\uDEC5\uDEF0\uDEF2-\uDEF8](?:\uD83C[\uDFFB-\uDFFF])?|[\uDD26\uDD35\uDD37-\uDD39\uDD3D\uDD3E\uDDB8\uDDB9\uDDCD\uDDCF\uDDD4\uDDD6-\uDDDD](?:\uD83C[\uDFFB-\uDFFF])?(?:\u200D[\u2640\u2642]\uFE0F?)?|[\uDDDE\uDDDF](?:\u200D[\u2640\u2642]\uFE0F?)?|[\uDD0D\uDD0E\uDD10-\uDD17\uDD20-\uDD25\uDD27-\uDD2F\uDD3A\uDD3F-\uDD45\uDD47-\uDD76\uDD78-\uDDB4\uDDB7\uDDBA\uDDBC-\uDDCC\uDDD0\uDDE0-\uDDFF\uDE70-\uDE7C\uDE80-\uDE89\uDE8F-\uDEC2\uDEC6\uDECE-\uDEDC\uDEDF-\uDEE9]|\uDD3C(?:\u200D[\u2640\u2642]\uFE0F?|\uD83C[\uDFFB-\uDFFF])?|\uDDCE(?:\uD83C[\uDFFB-\uDFFF])?(?:\u200D(?:[\u2640\u2642]\uFE0F?(?:\u200D\u27A1\uFE0F?)?|\u27A1\uFE0F?))?|\uDDD1(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\uD83C[\uDF3E\uDF73\uDF7C\uDF84\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]|\uDD1D\u200D\uD83E\uDDD1|\uDDD1\u200D\uD83E\uDDD2(?:\u200D\uD83E\uDDD2)?|\uDDD2(?:\u200D\uD83E\uDDD2)?))|\uD83C(?:\uDFFB(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D(?:\uD83D\uDC8B\u200D)?\uD83E\uDDD1\uD83C[\uDFFC-\uDFFF]|\uD83C[\uDF3E\uDF73\uDF7C\uDF84\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]|\uDD1D\u200D\uD83E\uDDD1\uD83C[\uDFFB-\uDFFF])))?|\uDFFC(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D(?:\uD83D\uDC8B\u200D)?\uD83E\uDDD1\uD83C[\uDFFB\uDFFD-\uDFFF]|\uD83C[\uDF3E\uDF73\uDF7C\uDF84\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]|\uDD1D\u200D\uD83E\uDDD1\uD83C[\uDFFB-\uDFFF])))?|\uDFFD(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D(?:\uD83D\uDC8B\u200D)?\uD83E\uDDD1\uD83C[\uDFFB\uDFFC\uDFFE\uDFFF]|\uD83C[\uDF3E\uDF73\uDF7C\uDF84\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]|\uDD1D\u200D\uD83E\uDDD1\uD83C[\uDFFB-\uDFFF])))?|\uDFFE(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D(?:\uD83D\uDC8B\u200D)?\uD83E\uDDD1\uD83C[\uDFFB-\uDFFD\uDFFF]|\uD83C[\uDF3E\uDF73\uDF7C\uDF84\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]|\uDD1D\u200D\uD83E\uDDD1\uD83C[\uDFFB-\uDFFF])))?|\uDFFF(?:\u200D(?:[\u2695\u2696\u2708]\uFE0F?|\u2764\uFE0F?\u200D(?:\uD83D\uDC8B\u200D)?\uD83E\uDDD1\uD83C[\uDFFB-\uDFFE]|\uD83C[\uDF3E\uDF73\uDF7C\uDF84\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E(?:[\uDDAF\uDDBC\uDDBD](?:\u200D\u27A1\uFE0F?)?|[\uDDB0-\uDDB3]|\uDD1D\u200D\uD83E\uDDD1\uD83C[\uDFFB-\uDFFF])))?))?|\uDEF1(?:\uD83C(?:\uDFFB(?:\u200D\uD83E\uDEF2\uD83C[\uDFFC-\uDFFF])?|\uDFFC(?:\u200D\uD83E\uDEF2\uD83C[\uDFFB\uDFFD-\uDFFF])?|\uDFFD(?:\u200D\uD83E\uDEF2\uD83C[\uDFFB\uDFFC\uDFFE\uDFFF])?|\uDFFE(?:\u200D\uD83E\uDEF2\uD83C[\uDFFB-\uDFFD\uDFFF])?|\uDFFF(?:\u200D\uD83E\uDEF2\uD83C[\uDFFB-\uDFFE])?))?)/g

function parseHTML(html: string): HTMLElement {
  const template = document.createElement('template')
  template.innerHTML = html
  return template.content.cloneNode(true) as HTMLElement
}

export class TextEditor extends HTMLElement {
  static observedAttributes = [
    'left',
    'top',
    'width',
    'height',
    'is-vertical',
  ]

  static register(): void {
    customElements.define('text-editor', this)
  }

  left = 0
  top = 0
  width = 0
  height = 0

  text = new Text()
  composition = false
  selection = [0, 0]
  prevSelection = [0, 0]
  protected _oldText = ''

  $preview: HTMLCanvasElement
  $textInput: HTMLTextAreaElement
  $cursor: HTMLElement
  $cursorInput: HTMLElement

  get selectionMinMax(): { min: number, max: number } {
    return {
      min: Math.min(...this.selection),
      max: Math.max(...this.selection),
    }
  }

  get selectedCharacters(): SelectableCharacter[] {
    const { min, max } = this.selectionMinMax
    return this.selectableCharacters.filter((_char, index) => {
      return index >= min && index < max
    })
  }

  get selectableCharacters(): SelectableCharacter[] {
    const paragraphs: Character[][][] = []
    this.text?.paragraphs.forEach((p, paragraphIndex) => {
      p.fragments.forEach((f, fragmentIndex) => {
        f.characters.forEach((c) => {
          paragraphs[paragraphIndex] ??= []
          paragraphs[paragraphIndex][fragmentIndex] ??= []
          paragraphs[paragraphIndex][fragmentIndex].push(c)
        })
      })
    })
    const toSelectableCharacter = (c: Character): SelectableCharacter => {
      return {
        color: c.computedStyle.color,
        left: c.inlineBox.left,
        top: c.inlineBox.top,
        width: c.inlineBox.width,
        height: c.inlineBox.height,
        content: c.content,
      }
    }
    const map: SelectableCharacter[] = []
    let pos = 0
    paragraphs.forEach((p) => {
      if (p.length === 1 && p[0].length === 1 && isCRLF(p[0][0].content)) {
        const c = p[0][0]
        map[pos] = {
          ...toSelectableCharacter(c),
          isCrlf: true,
        }
      }
      else {
        p.forEach((f) => {
          f.forEach((c) => {
            map[pos] = {
              ...toSelectableCharacter(c),
            }
            pos++
            if (!isCRLF(c.content)) {
              map[pos] = {
                ...toSelectableCharacter(c),
                content: ' ',
                isLastSelected: true,
              }
            }
          })
        })
      }
      pos++
    })
    if (map[0]) {
      map[0].isFirst = true
    }
    if (map[map.length - 1]) {
      map[map.length - 1].isLast = true
    }
    return map
  }

  get cursorPosition(): { left: number, top: number, width: number, height: number, color: string } {
    let left = 0
    let top = 0
    const { min } = this.selectionMinMax
    const char = this.selectableCharacters[min]
    if (char?.isLastSelected) {
      if (this.text.isVertical) {
        top += char?.height ?? 0
      }
      else {
        left += char?.width ?? 0
      }
    }
    left += char?.left ?? 0
    top += char?.top ?? 0
    return {
      color: char?.color,
      left,
      top,
      height: char?.height ?? 0,
      width: char?.width ?? 0,
    }
  }

  constructor() {
    super()

    const shadowRoot = this.attachShadow({ mode: 'open' })

    shadowRoot.appendChild(
      parseHTML(`
  <style>
  :host {
    position: absolute;
    width: 0;
    height: 0;
    outline-width: 2px;
    outline-style: dashed;
    --color: 0, 0, 0;
  }

  .preview {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    --selection-color: rgba(var(--color, 0, 0, 0), 0.4);
  }

  .text-input {
    position: absolute;
    z-index: -9999;
    opacity: 0;
    caret-color: transparent;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    padding: 0;
    border: 0;
  }

  .cursor {
    position: absolute;
    left: 0;
    top: 0;
    animation: cursor-blink 1s steps(2, start) infinite;
  }

  @keyframes cursor-blink {
    100% {
      display: none;
    }
  }

  .cursor-input {
    position: absolute;
    cursor: text;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    outline: 0;
  }
  </style>

  <canvas class="preview"></canvas>

  <textarea class="text-input"></textarea>

  <div class="cursor"></div>

  <div
    class="cursor-input"
    autofocus
    contenteditable="true"
  ></div>
`),
    )

    this.$preview = shadowRoot.querySelector('.preview') as HTMLCanvasElement
    this.$textInput = shadowRoot.querySelector('.text-input') as HTMLTextAreaElement
    this.$cursor = shadowRoot.querySelector('.cursor') as HTMLElement
    this.$cursorInput = shadowRoot.querySelector('.cursor-input') as HTMLElement

    this.$textInput.addEventListener('compositionstart', () => this.composition = true)
    this.$textInput.addEventListener('compositionend', () => this.composition = false)
    this.$textInput.addEventListener('keydown', this.onKeydown.bind(this))
    this.$textInput.addEventListener('input', this.onInput.bind(this) as any)
    this.$textInput.addEventListener('blur', this.onBlur.bind(this) as any)

    this.$cursorInput.addEventListener('keydown', e => e.preventDefault())
    this.$cursorInput.addEventListener('focus', this.onFocus.bind(this))
    this.$cursorInput.addEventListener('mousedown', this.onMousedown.bind(this))
  }

  update(options: TextOptions): void {
    this.text.set(options)
    this.setTextInput(this.getTextValue())
    this.render()
  }

  getTextValue(): string {
    return textContentToString(
      this.getContentValue(
        this.text.content,
      ),
    )
  }

  getContentValue(
    content: NormalizedTextContent,
    newString = textContentToString(content),
    oldString = newString,
  ): NormalizedTextContent {
    // 1. normalize text
    newString = normalizeCRLF(newString)
    newString = newString.replace(emojiRE, (emoji) => {
      if (Array.from(emoji).length > 1) {
        return '?'
      }
      return emoji
    })
    oldString = normalizeCRLF(oldString)
    // 2. diff style
    const oldStyles = contentsToCharStyles(content)
    const styles: Record<string, any>[] = []
    let styleIndex = 0
    let oldStyleIndex = 0
    let prevOldStyle: Record<string, any> = {}
    const changes = diffChars(oldString, newString)
    changes.forEach((change) => {
      const chars = Array.from(change.value)
      if (change.removed) {
        oldStyleIndex += chars.length
      }
      else {
        chars.forEach(() => {
          if (change.added) {
            styles[styleIndex] = { ...prevOldStyle }
          }
          else {
            prevOldStyle = normalizeStyle(oldStyles[oldStyleIndex])
            styles[styleIndex] = { ...prevOldStyle }
            oldStyleIndex++
          }
          styleIndex++
        })
      }
    })
    // 3. create new content
    let charIndex = 0
    const newContents: NormalizedTextContent = []
    normalizeTextContent(newString).forEach((p) => {
      let newParagraph: ParagraphObject = { fragments: [] }
      let newFragment: FragmentObject | undefined
      p.fragments.forEach((f) => {
        Array.from(f.content).forEach((char) => {
          const style = styles[charIndex] ?? {}
          if (newFragment) {
            const { content: _, ..._style } = newFragment
            if (isEqualStyle(style, _style)) {
              newFragment.content += char
            }
            else {
              newParagraph.fragments.push(newFragment)
              newFragment = { ...style, content: char }
            }
          }
          else {
            newFragment = { ...style, content: char }
          }
          charIndex++
        })
      })
      if (!isCRLF(p.fragments[p.fragments.length - 1].content)) {
        charIndex++
      }
      if (newFragment) {
        newParagraph.fragments.push(newFragment)
      }
      if (newParagraph.fragments.length) {
        newContents.push(newParagraph)
        newParagraph = { fragments: [] }
      }
    })
    return newContents
  }

  setTextInput(newText: string): void {
    this.$textInput.value = newText
    this._oldText = newText
  }

  onInput(): void {
    const newText = this.$textInput.value
    this.text.content = this.getContentValue(
      this.text.content,
      newText,
      this._oldText,
    )
    this._oldText = newText
    this.updateSelection()
    this.render()
  }

  onKeydown(e: KeyboardEvent): void {
    switch (e.key) {
      case 'Escape':
        // TODO 保存
        break
    }
    this.updateSelection()
    this.render()
    setTimeout(() => {
      this.updateSelection()
      this.render()
    }, 100)
  }

  onFocus(e: Event): void {
    e.preventDefault()
    this.$cursorInput.blur()
    this.$textInput?.focus()
  }

  onBlur(): void {
    // this.style.visibility = 'hidden'
  }

  findNearest(options: {
    x: number
    y: number
    xWeight?: number
    yWeight?: number
  }): number {
    const { x, y, xWeight = 1, yWeight = 1 } = options

    const char = this.selectableCharacters.reduce(
      (prev, current, index) => {
        const diff = (
          Math.abs(current.left + current.width / 2 - x) * xWeight
          + Math.abs(current.top + current.height / 2 - y) * yWeight
        )
        if (diff < prev.diff) {
          return {
            diff,
            index,
            value: current,
          }
        }
        return prev
      },
      {
        diff: Number.MAX_SAFE_INTEGER,
        index: -1,
        value: undefined as SelectableCharacter | undefined,
      },
    )

    if (char?.value) {
      const middleX = char.value.left + char.value.width / 2
      if (x > middleX && !char.value.isCrlf && !char.value.isLastSelected) {
        return char.index + 1
      }
      return char.index
    }

    return -1
  }

  updateSelection(): void {
    if (this.composition) {
      this.selection = this.prevSelection
    }
    else {
      let count = 0
      const _selection: number[] = []
      this.selectableCharacters.forEach((char, index) => {
        if (count <= this.$textInput.selectionStart) {
          _selection[0] = index
        }
        else if (count <= this.$textInput.selectionEnd) {
          _selection[1] = index
        }
        count += char.content.length
      })
      this.selection = _selection
      this.prevSelection = this.selection
    }
  }

  updateDOMSelection(): void {
    let start = 0
    let end = 0
    this.selectableCharacters.forEach((char, index) => {
      if (index < this.selectionMinMax.min) {
        start += char.content.length
        end = start
      }
      else if (index < this.selectionMinMax.max) {
        end += char.content.length
      }
    })
    this.$textInput.selectionStart = start
    this.$textInput.selectionEnd = end
  }

  onMousedown(e: MouseEvent): void {
    const index = this.findNearest({ x: e.offsetX, y: e.offsetY })
    this.selection = [index, index]
    this.updateDOMSelection()
    this.render()
    const onMousemove = (e: MouseEvent): void => {
      this.selection[1] = this.findNearest({ x: e.offsetX, y: e.offsetY })
      this.updateDOMSelection()
      this.render()
    }
    const onMouseup = (): void => {
      document.removeEventListener('mousemove', onMousemove)
      document.removeEventListener('mouseup', onMouseup)
    }
    document.addEventListener('mousemove', onMousemove)
    document.addEventListener('mouseup', onMouseup)
  }

  render(): void {
    this.text.update()

    this.width = this.text.boundingBox.width
    this.height = this.text.boundingBox.height

    const isVertical = this.text.isVertical

    this.style.left = `${this.left}px`
    this.style.top = `${this.top}px`
    this.style.width = `${this.width}px`
    this.style.height = `${this.height}px`

    // preview
    this.text.render({
      view: this.$preview,
    })

    // selection
    const ctx = this.$preview?.getContext('2d')
    if (ctx) {
      const boxesGroups: Record<number, Record<string, any>[]> = {}
      this.selectedCharacters.forEach((char) => {
        if (char.isLastSelected) {
          return
        }
        const key = isVertical
          ? char.left
          : char.top
        if (!boxesGroups[key]) {
          boxesGroups[key] = []
        }
        boxesGroups[key].push({
          x: char.left,
          y: char.top,
          w: char.width,
          h: char.height,
        })
      })
      ctx.fillStyle = getComputedStyle(this.$preview).getPropertyValue('--selection-color')
      Object.values(boxesGroups).forEach((boxes) => {
        const min = {
          x: Math.min(...boxes.map(v => v.x)),
          y: Math.min(...boxes.map(v => v.y)),
        }
        const max = {
          x: Math.max(...boxes.map(v => v.x + v.w)),
          y: Math.max(...boxes.map(v => v.y + v.h)),
        }
        ctx.fillRect(
          min.x,
          min.y,
          max.x - min.x,
          max.y - min.y,
        )
      })
    }

    // cursor
    const cursorPosition = this.cursorPosition
    this.$cursor.style.backgroundColor = cursorPosition.color ?? 'rgba(var(--color)'
    this.$cursor.style.left = `${cursorPosition.left}px`
    this.$cursor.style.top = `${cursorPosition.top}px`
    this.$cursor.style.height = isVertical ? '1px' : `${cursorPosition.height}px`
    this.$cursor.style.width = isVertical ? `${cursorPosition.width}px` : '1px'
  }

  attributeChangedCallback(name: string, oldValue: any, newValue: any): void {
    switch (name) {
      case 'left':
      case 'top':
      case 'width':
      case 'height':
        ;(this as any)[name] = newValue
        this.render()
        break
    }
  }
}
