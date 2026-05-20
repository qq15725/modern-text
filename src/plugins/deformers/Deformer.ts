import type { BoundingBox } from 'modern-path2d'
import type { Character, Paragraph } from '../../content'
import type { Text } from '../../Text'
import { LineCurve, QuadraticBezierCurve, Vector2 } from 'modern-path2d'
import { splitCurve } from './splitCurve'

export interface DeformerOptions {
  text: Text
  intensities?: number[]
  maxFontSize?: number
}

export abstract class Deformer {
  declare text: Text
  declare intensities: number[]
  declare lineHeight: number

  get boundingBox(): BoundingBox {
    return this.text.lineBox
  }

  get paragraphs(): Paragraph[] {
    return this.text.paragraphs
  }

  get isHorizontal(): boolean {
    return this.text.computedStyle.writingMode.startsWith('horizontal')
  }

  get baseWidth(): number {
    return this.isHorizontal ? this.boundingBox.width : this.boundingBox.height
  }

  get baseHeight(): number {
    return this.isHorizontal ? this.boundingBox.height : this.boundingBox.width
  }

  get characters(): Character[] {
    return this.paragraphs.flatMap(p => p.fragments.flatMap(f => f.characters))
  }

  constructor({ text, intensities = [], maxFontSize = 100 }: DeformerOptions) {
    this.text = text
    this.intensities = intensities.map(val => val / 100)
    this.lineHeight = maxFontSize
  }

  abstract deform(): void

  protected _breakLine(): void {
    const isVertical = !this.isHorizontal
    const { left, top, bottom, right } = this.boundingBox
    const x = 0.5 * (left + right)
    const y = 0.5 * (top + bottom)
    this.characters.forEach((character) => {
      if (!character.glyphBox) {
        return
      }
      character.path.curves.forEach((subPath) => {
        subPath.curves = subPath.curves.flatMap((curve) => {
          return splitCurve(curve, isVertical ? { y } : { x })
        })
      })
    })
  }

  protected _makeTheJointSmooth(): void {
    this.characters.forEach((character) => {
      if (!character.glyphBox) {
        return
      }
      character.path.getFlatCurves().forEach((curve) => {
        if (curve instanceof QuadraticBezierCurve && (curve as any).isFromLine) {
          const { p1, cp, p2 } = curve
          cp.x = 2 * cp.x - 0.5 * (p1.x + p2.x)
          cp.y = 2 * cp.y - 0.5 * (p1.y + p2.y)
        }
      })
    })
  }

  protected _lineToQuadraticBezier(): void {
    this.characters.forEach((character) => {
      if (!character.glyphBox) {
        return
      }
      character.path.curves.forEach((subPath) => {
        subPath.curves = subPath.curves.map((curve) => {
          if (curve instanceof LineCurve && curve.getLength() > 5) {
            const { p1, p2 } = curve
            const res = new QuadraticBezierCurve(
              p1.clone(),
              new Vector2(0.5 * (p1.x + p2.x), 0.5 * (p1.y + p2.y)),
              p2.clone(),
            );
            (res as any).isFromLine = true
            return res
          }
          return curve
        })
      })
    })
  }

  protected _transform(transform: any, getArg1?: any, getArg?: any): void {
    const highlight = this.text.plugins.get('highlight')

    const arg = getArg?.()
    let i = 0
    const charactersLength = this.characters.filter(c => c.glyphBox).length
    this.paragraphs.forEach((paragraph, paragraphIndex) => {
      paragraph.fragments.forEach((fragment, fragmentIndex) => {
        fragment.characters.forEach((character, characterIndex) => {
          if (!character.glyphBox) {
            return
          }
          const arg1 = getArg1?.(
            {
              paragraphIndex,
              fragmentIndex,
              characterIndex,
              character,
            },
            arg,
          )
          character.path.getControlPointRefs().forEach((point) => {
            const [x, y] = transform(point, arg1)
            point.set(x, y)
          })
          if (getArg1 && highlight?.pathSet?.paths) {
            const step = highlight.pathSet.paths.length / charactersLength
            const start = i * step
            for (let _i = 0; _i < step; _i++) {
              highlight?.pathSet?.paths[start + _i]?.getControlPointRefs().forEach((point) => {
                const [x, y] = transform(point, arg1)
                point.set(x, y)
              })
            }
            i++
          }
        })
      })
    })

    this.paragraphs.forEach((paragraph) => {
      paragraph.fragments.forEach((fragment) => {
        fragment.characters.forEach((character) => {
          character.glyphBox = character.getGlyphBoundingBox()
          if (character.glyphBox) {
            character.inlineBox = character.glyphBox
          }
        })
      })
    })

    if (!getArg1) {
      highlight?.pathSet?.paths?.forEach((v) => {
        v.getControlPointRefs().forEach((point) => {
          const [x, y] = transform(point)
          point.set(x, y)
        })
      })
    }
  }
}
