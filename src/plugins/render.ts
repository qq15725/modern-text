import type { Path2D } from 'modern-path2d'
import type { Character } from '../content/Character'
import type { Plugin } from '../types'
import { BoundingBox, Path2DSet } from 'modern-path2d'
import { definePlugin } from '../definePlugin'
import { getEffectTransform2D } from '../utils'

export function renderPlugin(): Plugin {
  const pathSet = new Path2DSet()
  // 惰性 pathSet：measure 阶段只记录字符引用，不读取 character.path（那会触发逐字 path 构建）。
  // 真正消费 pathSet（path 模式渲染/命中）首次访问 .paths 时才构建。`_lazyCount` 让
  // Text.measure 能在不触发构建的前提下判断「本插件是否产出 path」。
  let chars: Character[] = []
  let built: Path2D[] | null = []
  Object.defineProperty(pathSet, 'paths', {
    configurable: true,
    enumerable: true,
    get(): Path2D[] {
      if (built === null) {
        built = chars.map(c => c.path)
      }
      return built
    },
    set(value: Path2D[]) {
      built = value
    },
  })
  return definePlugin({
    name: 'render',
    pathSet,
    update: (text) => {
      const next: Character[] = []
      const { paragraphs } = text
      paragraphs.forEach((paragraph) => {
        paragraph.fragments.forEach((fragment) => {
          fragment.characters.forEach((character) => {
            next.push(character as unknown as Character)
          })
        })
      })
      chars = next
      built = null
      ;(pathSet as any)._lazyCount = next.length
    },
    getBoundingBox: (text) => {
      const { characters, computedEffects, fontSize } = text
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
            const sx = (effect.shadow.offsetX ?? 0) * fontSize
            const sy = (effect.shadow.offsetY ?? 0) * fontSize
            const sb = (effect.shadow.blur ?? 0) * fontSize
            const left = aabb.left + Math.min(0, sx - sb)
            const top = aabb.top + Math.min(0, sy - sb)
            const right = aabb.left + aabb.width + Math.max(0, sx + sb)
            const bottom = aabb.top + aabb.height + Math.max(0, sy + sb)
            aabb.left = left
            aabb.top = top
            aabb.width = right - left
            aabb.height = bottom - top
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
          if (effect.shadow?.enabled) {
            const bodyEffect = { ...effect, shadow: { ...effect.shadow, enabled: false } }
            renderer.drawWithShadow(effect.shadow, () => {
              text.forEachCharacter((character) => {
                renderer.drawCharacter(character, bodyEffect)
              })
            })
          }
          else {
            text.forEachCharacter((character) => {
              renderer.drawCharacter(character, effect)
            })
          }
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
