import type { NormalizedStyle } from 'modern-idoc'
import type { BoundingBox } from 'modern-path2d'

export function parseColor(
  ctx: CanvasRenderingContext2D,
  source: string | CanvasGradient | CanvasPattern,
  box: BoundingBox,
): string | CanvasGradient | CanvasPattern {
  if (typeof source === 'string' && source.startsWith('linear-gradient')) {
    const { x0, y0, x1, y1, stops } = parseCssLinearGradient(source, box.left, box.top, box.width, box.height)
    const gradient = ctx.createLinearGradient(x0, y0, x1, y1)
    stops.forEach(stop => gradient.addColorStop(stop.offset, stop.color))
    return gradient
  }
  return source
}

export function uploadColor(style: Partial<NormalizedStyle>, box: BoundingBox, ctx: CanvasRenderingContext2D): void {
  if (style?.color) {
    style.color = parseColor(ctx, style.color, box) as any // TODO
  }
  if (style?.backgroundColor) {
    style.backgroundColor = parseColor(ctx, style.backgroundColor, box) as any // TODO
  }
  if (style?.textStrokeColor) {
    style.textStrokeColor = parseColor(ctx, style.textStrokeColor, box) as any // TODO
  }
}

export interface LinearGradient {
  x0: number
  y0: number
  x1: number
  y1: number
  stops: { offset: number, color: string }[]
}

function parseCssLinearGradient(css: string, x: number, y: number, width: number, height: number): LinearGradient {
  const str = css.match(/linear-gradient\((.+)\)$/)?.[1] ?? ''
  const first = str.split(',')[0]
  const cssDeg = first.includes('deg') ? first : '0deg'
  const matched = str.replace(cssDeg, '').matchAll(/(#|rgba|rgb)(.+?) ([\d.]+%)/gi)
  const deg = Number(cssDeg.replace('deg', '')) || 0
  const rad = (deg * Math.PI) / 180
  const offsetX = width * Math.sin(rad)
  const offsetY = height * Math.cos(rad)
  return {
    x0: x + width / 2 - offsetX,
    y0: y + height / 2 + offsetY,
    x1: x + width / 2 + offsetX,
    y1: y + height / 2 - offsetY,
    stops: Array.from(matched).map((res) => {
      let color = res[2]
      if (color.startsWith('(')) {
        color = color.split(',').length > 3 ? `rgba${color}` : `rgb${color}`
      }
      else {
        color = `#${color}`
      }
      return {
        offset: Number(res[3].replace('%', '')) / 100,
        color,
      }
    }),
  }
}
