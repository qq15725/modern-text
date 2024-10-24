import type { TextEffect } from '../types'
import { BoundingBox, Matrix3, Vector2 } from 'modern-path2d'
import { uploadColor } from '../canvas'
import { Feature } from './Feature'

export interface EffectOptions {
  ctx: CanvasRenderingContext2D
}

const tempM1 = new Matrix3()
const tempM2 = new Matrix3()
const tempV1 = new Vector2()

export class Effector extends Feature {
  getTransform2D(style: TextEffect): Matrix3 {
    const { fontSize, renderBoundingBox } = this._text
    const offsetX = (style.offsetX ?? 0) * fontSize
    const offsetY = (style.offsetY ?? 0) * fontSize
    const PI_2 = Math.PI * 2
    const skewX = ((style.skewX ?? 0) / 360) * PI_2
    const skewY = ((style.skewY ?? 0) / 360) * PI_2
    const { left, top, width, height } = renderBoundingBox
    const centerX = left + width / 2
    const centerY = top + height / 2
    tempM1.identity()
    tempM2.makeTranslation(offsetX, offsetY)
    tempM1.multiply(tempM2)
    tempM2.makeTranslation(centerX, centerY)
    tempM1.multiply(tempM2)
    tempM2.set(1, Math.tan(skewX), 0, Math.tan(skewY), 1, 0, 0, 0, 1)
    tempM1.multiply(tempM2)
    tempM2.makeTranslation(-centerX, -centerY)
    tempM1.multiply(tempM2)
    return tempM1.clone()
  }

  getBoundingBox(): BoundingBox {
    const { characters, effects, fontSize } = this._text
    const boxes: BoundingBox[] = []
    characters.forEach((character) => {
      effects?.forEach((style) => {
        const aabb = character.boundingBox.clone()
        const m = this.getTransform2D(style)
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
    return BoundingBox.from(...boxes)
  }

  draw(options: EffectOptions): this {
    const { ctx } = options
    const { effects, characters, renderBoundingBox } = this._text
    if (effects) {
      effects.forEach((style) => {
        uploadColor(style, renderBoundingBox, ctx)
        ctx.save()
        const [a, c, e, b, d, f] = this.getTransform2D(style).transpose().elements
        ctx.transform(a, b, c, d, e, f)
        characters.forEach((character) => {
          character.drawTo(ctx, style)
        })
        ctx.restore()
      })
    }
    return this
  }
}
