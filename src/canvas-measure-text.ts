import { setContextStyle } from './set-context-style'
import type { TextStyle } from './types'

const SUPPORTS_OFFSCREEN_CANVAS = 'OffscreenCanvas' in globalThis

let currentCanvas: OffscreenCanvas | HTMLCanvasElement | undefined

export function getCurrentCanvas() {
  return currentCanvas ??= (
    SUPPORTS_OFFSCREEN_CANVAS
      ? new OffscreenCanvas(1, 1)
      : document.createElement('canvas')
  )
}

export function canvasMeasureText(textContent: string, style: TextStyle) {
  const ctx = getCurrentCanvas().getContext('2d') as CanvasRenderingContext2D
  setContextStyle(ctx, {
    ...style,
    textAlign: 'center',
    verticalAlign: 'baseline',
  })
  const {
    width,
    actualBoundingBoxAscent: glyphAscent,
    actualBoundingBoxDescent: glyphDescent,
    actualBoundingBoxLeft: glyphLeft,
    actualBoundingBoxRight: glyphRight,
    fontBoundingBoxAscent: typoAscent,
    fontBoundingBoxDescent: typoDescent,
  } = ctx.measureText(textContent)
  const lineHeight = style.fontSize * style.lineHeight
  const typoHeight = typoAscent + typoDescent
  return {
    width,
    height: style.fontSize,
    typoAscent,
    typoDescent,
    typoHeight,
    lineHeight,
    glyphLeft,
    glyphRight,
    glyphAscent,
    glyphDescent,
    glyphWidth: glyphLeft + glyphRight,
    glyphHeight: glyphAscent + glyphDescent,
    baseline: (lineHeight - typoHeight) / 2 + typoAscent,
    centerX: width / 2,
  }
}
