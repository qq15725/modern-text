import type { TextRenderOptions } from './Text'
import type { TextOptions } from './types'
import { Text } from './Text'

export function renderText(options: TextOptions & TextRenderOptions): Promise<void> {
  return new Text(options).render(options)
}
