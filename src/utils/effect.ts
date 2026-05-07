import type { NormalizedEffect } from 'modern-idoc'
import type { Text } from '../Text'
import { Transform2D } from 'modern-path2d'

export function getEffectTransform2D(text: Text, effect: NormalizedEffect): Transform2D {
  const { transform, transformOrigin } = effect
  const { fontSize, lineBox } = text
  const { left, top, width, height } = lineBox
  const { x: cx, y: cy } = parseTransformOrigin(
    transformOrigin ?? 'center',
    left, top, width, height,
  )
  const t = new Transform2D()
  if (transform) {
    t.translate(cx, cy)
    t.prependCssTransform(transform, {
      width: fontSize,
      height: fontSize,
    })
    t.translate(-cx, -cy)
  }
  return t
}

export function parseTransformOrigin(origin: string, left: number, top: number, width: number, height: number): { x: number, y: number } {
  const keywordX: Record<string, number> = { left: 0, center: 0.5, right: 1 }
  const keywordY: Record<string, number> = { top: 0, center: 0.5, bottom: 1 }

  const parts = origin.trim().split(/\s+/)
  const rawX = parts[0] ?? 'center'
  const rawY = parts[1] ?? 'center'

  let ox: number
  if (rawX in keywordX) {
    ox = left + keywordX[rawX] * width
  }
  else if (rawX.endsWith('%')) {
    ox = left + (Number.parseFloat(rawX) / 100) * width
  }
  else {
    ox = left + Number.parseFloat(rawX)
  }

  let oy: number
  if (rawY in keywordY) {
    oy = top + keywordY[rawY] * height
  }
  else if (rawY.endsWith('%')) {
    oy = top + (Number.parseFloat(rawY) / 100) * height
  }
  else {
    oy = top + Number.parseFloat(rawY)
  }

  return { x: ox, y: oy }
}
