import { BoundingBox } from 'modern-path2d'
import { uploadColor } from '../canvas'
import { Feature } from './Feature'

export interface EffectOptions {
  ctx: CanvasRenderingContext2D
}

export class Effector extends Feature {
  getBoundingBox(): BoundingBox {
    const { characters, effects } = this._text
    const boxes: BoundingBox[] = []
    characters.forEach((character) => {
      const fontSize = character.computedStyle.fontSize
      effects?.forEach((effect) => {
        const offsetX = (effect.offsetX ?? 0) * fontSize
        const offsetY = (effect.offsetY ?? 0) * fontSize
        const shadowOffsetX = (effect.shadowOffsetX ?? 0) * fontSize
        const shadowOffsetY = (effect.shadowOffsetY ?? 0) * fontSize
        const textStrokeWidth = Math.max(0.1, effect.textStrokeWidth ?? 0) * fontSize
        const aabb = character.boundingBox.clone()
        aabb.left += offsetX + shadowOffsetX - textStrokeWidth
        aabb.top += offsetY + shadowOffsetY - textStrokeWidth
        aabb.width += textStrokeWidth * 2
        aabb.height += textStrokeWidth * 2
        boxes.push(aabb)
      })
    })
    return BoundingBox.from(...boxes)
  }

  draw(options: EffectOptions): this {
    const { ctx } = options
    const { effects, characters, boundingBox } = this._text
    if (effects) {
      effects.forEach((effect) => {
        uploadColor(effect, boundingBox, ctx)
      })
      characters.forEach((character) => {
        effects.forEach((effect) => {
          character.drawTo(ctx, effect)
        })
      })
    }
    return this
  }
}
