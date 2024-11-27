import type { Path2D } from 'modern-path2d'
import type { TextPlugin } from '../types'
import { getPathsBoundingBox, Matrix3, parseSvg } from 'modern-path2d'
import { definePlugin } from '../definePlugin'
import { isNone, parseColormap, parseValueNumber } from '../utils'

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
        const {
          computedStyle: style,
        } = paragraph

        const {
          color,
          listStyleImage,
          listStyleColormap,
          listStyleSize,
          listStyleType,
        } = style

        const colormap = parseColormap(listStyleColormap)

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
          const scale = size === 'cover'
            ? 1
            : parseValueNumber(size, { total: fontSize, fontSize }) / fontSize
          const m = new Matrix3()
          if (isVertical) {
            const reScale = (fontSize / imageBox.height) * scale
            m.translate(-imageBox.left, -imageBox.top)
              .rotate(Math.PI / 2)
              .scale(reScale, reScale)
              .translate(fontSize / 2 - (imageBox.height * reScale) / 2, 0)
              .translate(box.left + (box.width - fontSize) / 2, fBox.top - padding)
          }
          else {
            const reScale = (fontSize / imageBox.height) * scale
            m.translate(-imageBox.left, -imageBox.top)
              .translate(-imageBox.width, 0)
              .scale(reScale, reScale)
              .translate(0, fontSize / 2 - (imageBox.height * reScale) / 2)
              .translate(fBox.left - padding, box.top + (box.height - fontSize) / 2)
          }

          paths.push(...imagePaths.map((p) => {
            const path = p.clone()
            path.matrix(m)
            if (path.style.fill && (path.style.fill as string) in colormap) {
              path.style.fill = colormap[path.style.fill as string]
            }
            if (path.style.stroke && (path.style.stroke as string) in colormap) {
              path.style.stroke = colormap[path.style.stroke as string]
            }
            return path
          }))
        }
      })
    },
  })
}
