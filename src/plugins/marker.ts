import type { Path2D } from '../lib'
import type { Plugin } from '../Plugin'
import { Matrix3, parseSvg } from '../lib'
import { plugin } from '../Plugin'
import { getPathsBoundingBox } from '../utils'

export interface MarkerOptions {
  image?: string
}

export function marker(options: MarkerOptions = {}): Plugin {
  const paths: Path2D[] = []
  return plugin({
    name: 'marker',
    paths,
    update: (text) => {
      if (!options.image)
        return
      const imagePaths = parseSvg(options.image)
      const imageBox = getPathsBoundingBox(imagePaths)!
      const { paragraphs } = text
      paragraphs.forEach((paragraph) => {
        const box = paragraph.fragments[0]?.characters[0]?.getGlyphBoundingBox()
        if (box) {
          const scale = box.height / imageBox.height
          const m = new Matrix3()
            .translate(-imageBox.left - imageBox.width, -imageBox.top)
            .scale(scale, scale)
            .translate(box.left, box.top)
          paths.push(...imagePaths.map(p => p.clone().matrix(m)))
        }
      })
    },
  })
}
