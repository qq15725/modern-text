import type { NormalizedStyle } from 'modern-idoc'
import type { Text } from '../Text'
import type { Plugin } from '../types'
import { BoundingBox, Matrix3, Path2DSet, Vector2 } from 'modern-path2d'
import { definePlugin } from '../definePlugin'

const tempV1 = new Vector2()
const tempM1 = new Matrix3()
const tempM2 = new Matrix3()

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
      const { characters, fontSize, computedEffects } = text
      const boxes: BoundingBox[] = []
      characters.forEach((character) => {
        computedEffects.forEach((style) => {
          if (!character.glyphBox) {
            return
          }
          const aabb = character.glyphBox.clone()
          const m = getTransform2D(text, style)
          tempV1.set(aabb.left, aabb.top)
          tempV1.applyMatrix3(m)
          aabb.left = tempV1.x
          aabb.top = tempV1.y
          tempV1.set(aabb.right, aabb.bottom)
          tempV1.applyMatrix3(m)
          aabb.width = tempV1.x - aabb.left
          aabb.height = tempV1.y - aabb.top
          const shadowOffsetX = (style.shadowOffsetX ?? 0) * fontSize
          const shadowOffsetY = (style.shadowOffsetY ?? 0) * fontSize
          const textStrokeWidth = Math.max(0.1, style.textStrokeWidth ?? 0) * fontSize
          aabb.left += shadowOffsetX - textStrokeWidth
          aabb.top += shadowOffsetY - textStrokeWidth
          aabb.width += textStrokeWidth * 2
          aabb.height += textStrokeWidth * 2
          boxes.push(aabb)
        })
      })
      return boxes.length ? BoundingBox.from(...boxes) : undefined
    },
    render: (renderer) => {
      const { text, context } = renderer
      const { paragraphs, glyphBox, computedEffects } = text

      if (paragraphs.length && computedEffects.length) {
        computedEffects.forEach((style) => {
          renderer.uploadColor(glyphBox, style)
          context.save()
          const [a, c, e, b, d, f] = getTransform2D(text, style).transpose().elements
          context.transform(a, b, c, d, e, f)
          text.forEachCharacter((character) => {
            renderer.drawCharacter(character, style)
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

export function getTransform2D(text: Text, style: NormalizedStyle): Matrix3 {
  const { fontSize, glyphBox } = text
  const translateX = (style.translateX ?? 0) * fontSize
  const translateY = (style.translateY ?? 0) * fontSize
  const PI_2 = Math.PI * 2
  const skewX = ((style.skewX ?? 0) / 360) * PI_2
  const skewY = ((style.skewY ?? 0) / 360) * PI_2
  const { left, top, width, height } = glyphBox
  const centerX = left + width / 2
  const centerY = top + height / 2
  tempM1.identity()
  tempM2.makeTranslation(translateX, translateY)
  tempM1.multiply(tempM2)
  tempM2.makeTranslation(centerX, centerY)
  tempM1.multiply(tempM2)
  tempM2.set(1, Math.tan(skewX), 0, Math.tan(skewY), 1, 0, 0, 0, 1)
  tempM1.multiply(tempM2)
  tempM2.makeTranslation(-centerX, -centerY)
  tempM1.multiply(tempM2)
  return tempM1.clone()
}
