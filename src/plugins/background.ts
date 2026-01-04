import type { Plugin } from '../types'
import { isNone } from 'modern-idoc'
import { BoundingBox, Matrix3, Path2DSet, Vector2 } from 'modern-path2d'
import { createSvgLoader, createSvgParser, parseColormap } from '../utils'

export function backgroundPlugin(): Plugin {
  const pathSet = new Path2DSet()
  const loader = createSvgLoader()
  const parser = createSvgParser(loader)

  return {
    name: 'background',
    pathSet,
    load: async (text) => {
      const { backgroundImage } = text.computedStyle
      if (backgroundImage && loader.needsLoad(backgroundImage)) {
        await loader.load(backgroundImage)
      }
    },
    update: (text) => {
      pathSet.paths.length = 0
      const { computedStyle, lineBox, isVertical } = text
      const {
        backgroundImage,
        backgroundSize,
        backgroundColormap,
      } = computedStyle

      if (isNone(backgroundImage))
        return

      const { pathSet: imagePathSet } = parser.parse(backgroundImage)
      const imageBox = imagePathSet.getBoundingBox(true) ?? new BoundingBox()

      let x, y, width, height
      if (isVertical) {
        ({ x: y, y: x, width: height, height: width } = lineBox)
      }
      else {
        ({ x, y, width, height } = lineBox)
      }

      const colormap = parseColormap(backgroundColormap ?? 'none')
      const paths = imagePathSet.paths.map((p) => {
        const cloned = p.clone()
        if (cloned.style.fill && (cloned.style.fill as string) in colormap) {
          cloned.style.fill = colormap[cloned.style.fill as string]
        }
        if (cloned.style.stroke && (cloned.style.stroke as string) in colormap) {
          cloned.style.stroke = colormap[cloned.style.stroke as string]
        }
        return cloned
      })

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
    render: (renderer) => {
      const { text, context } = renderer
      const { boundingBox, computedStyle: style } = text

      if (!isNone(style.backgroundColor)) {
        context.fillStyle = style.backgroundColor!
        context.fillRect(...boundingBox.array)
      }
      pathSet.paths.forEach((path) => {
        renderer.drawPath(path)
        if (text.debug) {
          const box = new Path2DSet([path]).getBoundingBox()
          if (box) {
            context.strokeRect(box.x, box.y, box.width, box.height)
          }
        }
      })
      text.paragraphs.forEach((p) => {
        const { lineBox, style } = p
        if (!isNone(style.backgroundColor)) {
          context.fillStyle = style.backgroundColor!
          context.fillRect(...lineBox.array)
        }
        p.fragments.forEach((f) => {
          const { inlineBox, style } = f
          if (!isNone(style.backgroundColor)) {
            context.fillStyle = style.backgroundColor!
            context.fillRect(...inlineBox.array)
          }
        })
      })
    },
  }
}
