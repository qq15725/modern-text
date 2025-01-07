import type { Path2D } from 'modern-path2d'
import type { Character } from '../content'
import type { TextPlugin } from '../types'
import { Matrix3, svgToPath2DSet } from 'modern-path2d'
import { definePlugin } from '../definePlugin'
import { isNone, parseColormap, parseValueNumber } from '../utils'

function genDisc(r: number, color: string): string {
  return `<svg width="${r * 2}" height="${r * 2}" xmlns="http://www.w3.org/2000/svg">
  <circle cx="${r}" cy="${r}" r="${r}" fill="${color}" />
</svg>`
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
              image = genDisc(r, String(color))
              break
          }
        }

        if (!image) {
          return
        }

        const imagePathSet = svgToPath2DSet(image)
        const imageBox = imagePathSet.getBoundingBox()!

        let prevChar: Character | undefined
        paragraph.fragments.forEach((f) => {
          f.characters.forEach((c) => {
            const { inlineBox } = c
            if (
              isVertical
                ? prevChar?.inlineBox.left !== inlineBox.left
                : prevChar?.inlineBox.top !== inlineBox.top
            ) {
              prevChar = c
              const scale = size === 'cover'
                ? 1
                : parseValueNumber(size, { total: fontSize, fontSize }) / fontSize
              const m = new Matrix3()
              if (isVertical) {
                const _scale = (fontSize / imageBox.height) * scale
                m.translate(-imageBox.left, -imageBox.top)
                  .rotate(Math.PI / 2)
                  .scale(_scale, _scale)
                  .translate(
                    inlineBox.left + (inlineBox.width - (imageBox.height * _scale)) / 2,
                    inlineBox.top - padding,
                  )
              }
              else {
                const _scale = (fontSize / imageBox.height) * scale
                m
                  .translate(-imageBox.left, -imageBox.top)
                  .scale(_scale, _scale)
                  .translate(
                    inlineBox.left - (imageBox.width * _scale) - padding,
                    inlineBox.top + (inlineBox.height - (imageBox.height * _scale)) / 2,
                  )
              }
              paths.push(...imagePathSet.paths.map((p) => {
                const path = p.clone()
                path.applyTransform(m)
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
        })
      })
    },
  })
}
