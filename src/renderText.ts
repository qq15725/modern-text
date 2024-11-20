import type { TextRenderOptions } from './Text'
import type { TextOptions } from './types'
import { Text } from './Text'

export function renderText(options: TextOptions & TextRenderOptions): Text {
  return new Text(options).render(options)
}
