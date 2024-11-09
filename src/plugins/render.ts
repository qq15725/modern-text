import type { Plugin } from '../Plugin'
import type { Text } from '../Text'
import type { TextStyle } from '../types'
import { BoundingBox, Matrix3, Vector2 } from 'modern-path2d'
import { uploadColor } from '../canvas'
import { definePlugin } from '../Plugin'

const tempV1 = new Vector2()
const tempM1 = new Matrix3()
const tempM2 = new Matrix3()

export function render(): Plugin {
  return definePlugin({
    name: 'render',
    getBoundingBox: (text) => {
      const { characters, fontSize, effects } = text
      const boxes: BoundingBox[] = []
      characters.forEach((character) => {
        effects?.forEach((style) => {
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
    render: (ctx, text) => {
      const { characters, paragraphs, renderBoundingBox, effects, style } = text
      function fillBackground(color: any, box: BoundingBox): void {
        ctx.fillStyle = color
        ctx.fillRect(box.left, box.top, box.width, box.height)
      }
      if (style?.backgroundColor) {
        fillBackground(style.backgroundColor, new BoundingBox(0, 0, ctx.canvas.width, ctx.canvas.height))
      }
      paragraphs.forEach((paragraph) => {
        if (paragraph.style?.backgroundColor) {
          fillBackground(paragraph.style.backgroundColor, paragraph.lineBox)
        }
      })
      if (effects) {
        effects.forEach((style) => {
          uploadColor(style, renderBoundingBox, ctx)
          ctx.save()
          const [a, c, e, b, d, f] = getTransform2D(text, style).transpose().elements
          ctx.transform(a, b, c, d, e, f)
          characters.forEach((character) => {
            if (character.parent.style?.backgroundColor) {
              fillBackground(character.parent.style.backgroundColor, character.inlineBox)
            }
            character.drawTo(ctx, style)
          })
          ctx.restore()
        })
      }
      else {
        paragraphs.forEach((paragraph) => {
          paragraph.fragments.forEach((fragment) => {
            if (fragment.style?.backgroundColor) {
              fillBackground(fragment.computedStyle.backgroundColor, fragment.inlineBox)
            }
            fragment.characters.forEach((character) => {
              character.drawTo(ctx)
            })
          })
        })
      }
    },
  })
}

export function getTransform2D(text: Text, style: Partial<TextStyle>): Matrix3 {
  const { fontSize, renderBoundingBox } = text
  const translateX = (style.translateX ?? 0) * fontSize
  const translateY = (style.translateY ?? 0) * fontSize
  const PI_2 = Math.PI * 2
  const skewX = ((style.skewX ?? 0) / 360) * PI_2
  const skewY = ((style.skewY ?? 0) / 360) * PI_2
  const { left, top, width, height } = renderBoundingBox
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
