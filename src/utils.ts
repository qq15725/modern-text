export function parseCssLinearGradient(css: string, x: number, y: number, width: number, height: number) {
  const str = css.match(/linear-gradient\((.+)\)$/)?.[1] ?? ''
  const first = str.split(',')[0]
  const cssDeg = first.includes('deg') ? first : '0deg'
  const matched = str
    .replace(cssDeg, '')
    .matchAll(/(#|rgba|rgb)(.+?) ([\d.]+?%)/gi)
  const deg = Number(cssDeg.replace('deg', '')) || 0
  const rad = deg * Math.PI / 180
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
        color = color.split(',').length > 3 ? `rgba${ color }` : `rgb${ color }`
      } else {
        color = `#${ color }`
      }
      return {
        offset: Number(res[3].replace('%', '')) / 100,
        color,
      }
    }),
  }
}
