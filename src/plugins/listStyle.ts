import type { Path2D } from 'modern-path2d'
import type { Plugin } from '../Plugin'
import type { ListStyleSize } from '../types'
import { getPathsBoundingBox, Matrix3, parseSvg } from 'modern-path2d'
import { definePlugin } from '../Plugin'
import { isNone } from '../utils'

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

export function listStyle(): Plugin {
  const paths: Path2D[] = []
  return definePlugin({
    name: 'listStyle',
    paths,
    update: (text) => {
      paths.length = 0
      const { paragraphs, computedStyle: style, fontSize, isVertical } = text
      let listStyleSize = style.listStyleSize
      let image: string | undefined
      if (!isNone(style.listStyleImage)) {
        image = style.listStyleImage
      }
      else if (!isNone(style.listStyleType)) {
        const r = fontSize * 0.38 / 2
        listStyleSize = listStyleSize === 'cover' ? r * 2 : listStyleSize
        switch (style.listStyleType) {
          case 'disc':
            image = `<svg width="${r * 2}" height="${r * 2}" xmlns="http://www.w3.org/2000/svg">
  <circle cx="${r}" cy="${r}" r="${r}" fill="${style.color}" />
</svg>`
            break
        }
      }
      if (!image) {
        return
      }
      const padding = fontSize * 0.45
      const imagePaths = parseSvg(image)
      const imageBox = getPathsBoundingBox(imagePaths)!
      paragraphs.forEach((paragraph) => {
        const box = paragraph.lineBox
        if (box) {
          const m = new Matrix3()
          if (isVertical) {
            const scale = parseScale(listStyleSize, style.fontSize, box.width)
            const reScale = (box.width / imageBox.height) * scale
            m.translate(-imageBox.left, -imageBox.top)
            m.rotate(Math.PI / 2)
            m.scale(reScale, reScale)
            m.translate(box.width / 2 - (imageBox.height * reScale) / 2, 0)
            m.translate(box.left, box.top - padding)
          }
          else {
            const scale = parseScale(listStyleSize, style.fontSize, box.height)
            const reScale = (box.height / imageBox.height) * scale
            m.translate(-imageBox.left, -imageBox.top)
            m.translate(-imageBox.width, 0)
            m.scale(reScale, reScale)
            m.translate(0, box.height / 2 - (imageBox.height * reScale) / 2)
            m.translate(box.left - padding, box.top)
          }
          paths.push(...imagePaths.map(p => p.clone().matrix(m)))
        }
      })
    },
  })
}
