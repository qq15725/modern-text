import type { Path2D } from 'modern-path2d'
import type { Plugin } from '../Plugin'
import { getPathsBoundingBox, Matrix3, parseSvg } from 'modern-path2d'
import { plugin } from '../Plugin'
import { isNone } from '../utils'

export function listStyle(): Plugin {
  const paths: Path2D[] = []
  return plugin({
    name: 'listStyle',
    paths,
    update: (text) => {
      const { paragraphs, computedStyle: style, fontSize } = text
      let image: string | undefined
      let _scale = false
      if (!isNone(style.listStyleImage)) {
        image = style.listStyleImage
        _scale = true
      }
      else if (!isNone(style.listStyleType)) {
        const r = fontSize * 0.38 / 2
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
          const scale = box.height / imageBox.height
          const m = new Matrix3()
          m.translate(-imageBox.left - imageBox.width, -imageBox.top)
          if (_scale) {
            m.scale(scale, scale)
          }
          else {
            m.translate(0, box.height / 2 - imageBox.height / 2)
          }
          m.translate(box.left - paddingLeft, box.top)
          paths.push(...imagePaths.map(p => p.clone().matrix(m)))
        }
      })
    },
  })
}
