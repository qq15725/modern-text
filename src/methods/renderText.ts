import type { TextRenderOptions } from '../Text'
import type { TextOptions } from '../types'
import { Text } from '../Text'

export type RenderTextOptions = TextOptions & TextRenderOptions

export function renderText(options: RenderTextOptions, load: true): Promise<void>
export function renderText(options: RenderTextOptions): void
export function renderText(options: RenderTextOptions, load?: boolean): void | Promise<void> {
  const text = new Text(options)
  if (load) {
    return text.load().then(() => {
      return text.render(options)
    })
  }
  return text.render(options)
}
