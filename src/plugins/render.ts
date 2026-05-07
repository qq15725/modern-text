import type { Plugin } from '../types'
import { BoundingBox, Path2DSet } from 'modern-path2d'
import { definePlugin } from '../definePlugin'
import { getEffectTransform2D } from '../utils'

export function renderPlugin(): Plugin {
  const pathSet = new Path2DSet()
  return definePlugin({
    name: 'render',
    pathSet,
    update: (text) => {
      pathSet.paths.length = 0

      const { paragraphs } = text

      // TODO effects

      paragraphs.forEach((paragraph) => {
        paragraph.fragments.forEach((fragment) => {
          fragment.characters.forEach((character) => {
            pathSet.paths.push(character.path)
          })
        })
      })
    },
    getBoundingBox: (text) => {
      const { characters, computedEffects } = text
      const boxes: BoundingBox[] = []
      computedEffects.forEach((effect) => {
        const t2d = getEffectTransform2D(text, effect)
        characters.forEach((character) => {
          if (!character.glyphBox) {
            return
          }
          const aabb = character.glyphBox.clone()
          const p1 = t2d.apply({ x: aabb.left, y: aabb.top })
          const p2 = t2d.apply({ x: aabb.right, y: aabb.top })
          const p3 = t2d.apply({ x: aabb.right, y: aabb.bottom })
          const p4 = t2d.apply({ x: aabb.left, y: aabb.bottom })
          const minX = Math.min(p1.x, p2.x, p3.x, p4.x)
          const minY = Math.min(p1.y, p2.y, p3.y, p4.y)
          const maxX = Math.max(p1.x, p2.x, p3.x, p4.x)
          const maxY = Math.max(p1.y, p2.y, p3.y, p4.y)
          aabb.left = minX
          aabb.top = minY
          aabb.width = maxX - minX
          aabb.height = maxY - minY
          if (effect.shadow?.enabled) {
            const { offsetX = 0, offsetY = 0 } = effect.shadow
            aabb.left -= offsetX
            aabb.top -= offsetY
          }
          if (effect.outline?.enabled) {
            const outlineWidth = Math.max(0.1, effect.outline.width ?? 0)
            aabb.left -= outlineWidth
            aabb.top -= outlineWidth
            aabb.width += outlineWidth * 2
            aabb.height += outlineWidth * 2
          }
          boxes.push(aabb)
        })
      })
      return boxes.length ? BoundingBox.from(...boxes) : undefined
    },
    render: (renderer) => {
      const { text, context } = renderer
      const {
        paragraphs,
        glyphBox,
        computedEffects: effects,
      } = text

      if (!paragraphs.length) {
        return
      }

      if (effects.length) {
        effects.forEach((effect) => {
          renderer.uploadColor(glyphBox, effect)
          context.save()
          renderer.transformEffect(effect)
          text.forEachCharacter((character) => {
            renderer.drawCharacter(character, effect)
          })
          context.restore()
        })
      }
      else {
        paragraphs.forEach((paragraph) => {
          paragraph.fragments.forEach((fragment) => {
            fragment.characters.forEach((character) => {
              renderer.drawCharacter(character)
            })
          })
        })
      }

      if (text.debug) {
        paragraphs.forEach((paragraph) => {
          context.strokeRect(
            paragraph.lineBox.x,
            paragraph.lineBox.y,
            paragraph.lineBox.width,
            paragraph.lineBox.height,
          )
        })
      }
    },
  })
}
