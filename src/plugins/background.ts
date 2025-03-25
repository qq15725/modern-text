import type { TextPlugin } from '../types'
import { Matrix3, Path2DSet } from 'modern-path2d'
import { drawPath } from '../canvas'
import { createSVGLoader, createSVGParser, isNone } from '../utils'

export function background(): TextPlugin {
  const pathSet = new Path2DSet()
  const loader = createSVGLoader()
  const parser = createSVGParser(loader)

  return {
    name: 'background',
    pathSet,
    load: async (text) => {
      const { backgroundImage } = text.style
      if (backgroundImage && loader.needsLoad(backgroundImage)) {
        await loader.load(backgroundImage)
      }
    },
    update: (text) => {
      pathSet.paths.length = 0
      const { style, lineBox, isVertical } = text
      if (isNone(style.backgroundImage))
        return
      const { pathSet: imagePathSet } = parser.parse(style.backgroundImage!)
      const imageBox = imagePathSet.getBoundingBox(true)!
      const transform = new Matrix3()
      transform.translate(-imageBox.x, -imageBox.y)
      if (isVertical) {
        transform.scale(lineBox.height / imageBox.width, lineBox.width / imageBox.height)
        const tx = lineBox.height / 2
        const ty = lineBox.width / 2
        transform.translate(-tx, -ty)
        transform.rotate(-Math.PI / 2)
        transform.translate(ty, tx)
      }
      else {
        transform.scale(lineBox.width / imageBox.width, lineBox.height / imageBox.height)
      }
      transform.translate(lineBox.x, lineBox.y)
      imagePathSet.paths.forEach((originalPath) => {
        pathSet.paths.push(
          originalPath.clone().applyTransform(transform),
        )
      })
    },
    render: (ctx, text) => {
      const { boundingBox, computedStyle: style } = text
      if (!isNone(style.backgroundColor)) {
        ctx.fillStyle = style.backgroundColor!
        ctx.fillRect(...boundingBox.array)
      }
      pathSet.paths.forEach((path) => {
        drawPath({
          ctx,
          path,
          fontSize: style.fontSize,
        })
        if (text.debug) {
          const box = new Path2DSet([path]).getBoundingBox()
          if (box) {
            ctx.strokeRect(box.x, box.y, box.width, box.height)
          }
        }
      })
    },
  }
}
