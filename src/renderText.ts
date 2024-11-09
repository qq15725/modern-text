import type { TextOptions, TextRenderOptions } from './Text'
import { Text } from './Text'

export function renderText(options: TextOptions & TextRenderOptions): Text {
  return new Text(options).render(options)
}
