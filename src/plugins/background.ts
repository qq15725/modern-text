import type { TextPlugin } from '../types'
import { Matrix3, Path2DSet, Vector2 } from 'modern-path2d'
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
      const { backgroundImage, backgroundSize } = style
      if (isNone(backgroundImage))
        return
      const { pathSet: imagePathSet } = parser.parse(backgroundImage!)
      const imageBox = imagePathSet.getBoundingBox(true)!

      let x, y, width, height
      if (isVertical) {
        ({ x: y, y: x, width: height, height: width } = lineBox)
      }
      else {
        ({ x, y, width, height } = lineBox)
      }

      const paths = imagePathSet.paths.map(p => p.clone())

      let scaleX: number
      let scaleY: number
      if (backgroundSize === 'rigid') {
        scaleX = Math.max((text.fontSize * 5) / imageBox.width)
        scaleY = scaleX
        const dist = new Vector2()
        dist.x = imageBox.width - width / scaleX
        dist.y = imageBox.height - height / scaleY
        paths.forEach((path) => {
          path.applyTransform((p) => {
            const hasX = p.x > imageBox.left + imageBox.width / 2
            const hasY = p.y > imageBox.top + imageBox.height / 2
            if (hasX) {
              p.x -= dist.x
            }
            if (hasY) {
              p.y -= dist.y
            }
          })
        })
      }
      else {
        scaleX = width / imageBox.width
        scaleY = height / imageBox.height
      }

      const transform = new Matrix3()
      transform.translate(-imageBox.x, -imageBox.y)
      transform.scale(scaleX, scaleY)
      if (isVertical) {
        transform.translate(-width / 2, -height / 2)
        transform.rotate(-Math.PI / 2)
        transform.translate(height / 2, width / 2)
      }
      transform.translate(x, y)

      paths.forEach((path) => {
        path.applyTransform((p) => {
          p.applyMatrix3(transform)
        })
      })

      pathSet.paths.push(...paths)
    },
    renderOrder: -2,
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
