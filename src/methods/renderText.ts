import type { TextRenderOptions } from '../Text'
import type { TextOptions } from '../types'
import { Text } from '../Text'

export async function renderText(options: TextOptions & TextRenderOptions): Promise<void> {
  const text = new Text(options)
  await text.load()
  text.render(options)
}
