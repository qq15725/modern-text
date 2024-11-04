import type { Path2D } from 'modern-path2d'
import type { Plugin } from '../Plugin'
import type { ListStyleSize } from '../types'
import { getPathsBoundingBox, Matrix3, parseSvg } from 'modern-path2d'
import { plugin } from '../Plugin'
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
  return plugin({
    name: 'listStyle',
    update: (text) => {
      const { paragraphs, computedStyle: style, fontSize } = text
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
      const paddingLeft = fontSize * 0.45
      const imagePaths = parseSvg(image)
      const imageBox = getPathsBoundingBox(imagePaths)!
      paragraphs.forEach((paragraph) => {
        const box = paragraph.fragments[0]?.characters[0]?.getGlyphBoundingBox()
        if (box) {
          const scale = parseScale(listStyleSize, style.fontSize, box.height)
          const reScale = (box.height / imageBox.height) * scale
          const m = new Matrix3()
          m.translate(-imageBox.left - imageBox.width, -imageBox.top)
          m.scale(reScale, reScale)
          m.translate(0, box.height / 2 - (imageBox.height * reScale) / 2)
          m.translate(box.left - paddingLeft, box.top)
          paths.push(...imagePaths.map(p => p.clone().matrix(m)))
        }
      })
    },
    paths,
  })
}
