import type { RenderOptions } from '../Text'
import type { Options } from '../types'
import { Text } from '../Text'

export type RenderTextOptions = Options & RenderOptions

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
