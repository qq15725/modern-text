import type { Path2D } from 'modern-path2d'
import type { ListStyleSize, TextPlugin } from '../types'
import { getPathsBoundingBox, Matrix3, parseSvg } from 'modern-path2d'
import { definePlugin } from '../definePlugin'
import { hexToRgb, isNone } from '../utils'

function parseScale(size: ListStyleSize, fontSize: number, total: number): number {
  if (size === 'cover') {
    return 1
  }
  else if (typeof size === 'string') {
    if (size.endsWith('%')) {
      return Number(size.substring(0, size.length - 1)) / 100
    }
    else if (size.endsWith('rem')) {
      const value = Number(size.substring(0, size.length - 3))
      return value * fontSize / total
    }
    else {
      return Number(size) / total
    }
  }
  else {
    return size / total
  }
}

export function listStyle(): TextPlugin {
  const paths: Path2D[] = []
  return definePlugin({
    name: 'listStyle',
    paths,
    update: (text) => {
      paths.length = 0
      const { paragraphs, isVertical, fontSize } = text
      const padding = fontSize * 0.45
      paragraphs.forEach((paragraph) => {
        const { computedStyle: style } = paragraph
        const { listStyleImage, listStyleImageColors, listStyleSize, listStyleType, color } = style
        const colors = Object.keys(listStyleImageColors).reduce((obj, key) => {
          let value = listStyleImageColors[key]
          const keyRgb = hexToRgb(key)
          const valueRgb = hexToRgb(value)
          if (keyRgb) {
            key = keyRgb
          }
          if (valueRgb) {
            value = valueRgb
          }
          obj[key] = value
          return obj
        }, {} as Record<string, string>)
        let size = listStyleSize
        let image: string | undefined
        if (!isNone(listStyleImage)) {
          image = listStyleImage
        }
        else if (!isNone(listStyleType)) {
          const r = fontSize * 0.38 / 2
          size = size === 'cover' ? r * 2 : size
          switch (listStyleType) {
            case 'disc':
              image = `<svg width="${r * 2}" height="${r * 2}" xmlns="http://www.w3.org/2000/svg">
  <circle cx="${r}" cy="${r}" r="${r}" fill="${color}" />
</svg>`
              break
          }
        }
        if (!image) {
          return
        }
        const imagePaths = parseSvg(image)
        const imageBox = getPathsBoundingBox(imagePaths)!
        const box = paragraph.lineBox
        const fBox = paragraph.fragments[0].inlineBox
        if (fBox) {
          const m = new Matrix3()
          if (isVertical) {
            const scale = parseScale(size, fontSize, fontSize)
            const reScale = (fontSize / imageBox.height) * scale
            m.translate(-imageBox.left, -imageBox.top)
            m.rotate(Math.PI / 2)
            m.scale(reScale, reScale)
            m.translate(fontSize / 2 - (imageBox.height * reScale) / 2, 0)
            m.translate(box.left + (box.width - fontSize) / 2, fBox.top - padding)
          }
          else {
            const scale = parseScale(size, fontSize, fontSize)
            const reScale = (fontSize / imageBox.height) * scale
            m.translate(-imageBox.left, -imageBox.top)
            m.translate(-imageBox.width, 0)
            m.scale(reScale, reScale)
            m.translate(0, fontSize / 2 - (imageBox.height * reScale) / 2)
            m.translate(fBox.left - padding, box.top + (box.height - fontSize) / 2)
          }
          paths.push(...imagePaths.map((p) => {
            const path = p.clone()
            path.matrix(m)
            if (path.style.fill && (path.style.fill as string) in colors) {
              path.style.fill = colors[path.style.fill as string]
            }
            if (path.style.stroke && (path.style.stroke as string) in colors) {
              path.style.stroke = colors[path.style.stroke as string]
            }
            return path
          }))
        }
      })
    },
  })
}
