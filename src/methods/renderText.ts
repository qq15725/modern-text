import type { TextRenderOptions } from '../Text'
import type { TextOptions } from '../types'
import { Text } from '../Text'

export function renderText(options: TextOptions & TextRenderOptions): void {
  new Text(options).render(options)
}
