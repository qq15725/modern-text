import type { TextStyle } from './types'

export function domMeasureText(textContent: string, style: TextStyle) {
  const fragment = document.createDocumentFragment()
  const div = document.createElement('div')
  div.style.position = 'absolute'
  div.style.visibility = 'hidden'
  div.setAttribute('aria-hidden', 'true')
  div.style.fontFamily = style.fontFamily
  div.style.fontSize = `${ style.fontSize }px`
  div.style.lineHeight = String(style.lineHeight)
  div.style.whiteSpace = 'nowrap'
  div.style.writingMode = style.writingMode
  const span = document.createElement('span')
  span.textContent = /\s/.test(textContent) ? '&nbsp;' : textContent
  div.appendChild(span)
  fragment.appendChild(div)
  document.body.appendChild(fragment)
  const result = {
    leading: span.offsetHeight - style.fontSize,
  }
  document.body.removeChild(div)
  return result
}
