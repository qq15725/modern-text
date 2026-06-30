import type { BoundingBox } from 'modern-path2d'
import type { Character, Paragraph } from '../../content'
import type { Text } from '../../Text'
import { LineCurve, QuadraticBezierCurve, Vector2 } from 'modern-path2d'
import { splitCurve } from './splitCurve'

export interface DeformerOptions {
  text: Text
  /** 各轴强度，0–100（内部 /100）。单轴预设读 [0]，双轴预设（skew/trapezoid…）另读 [1]。 */
  intensities?: number[]
  /**
   * @deprecated 变形半径基准已改为从文字真实最大字号自动推导（缩放无关），无需再传。
   * 仅在无可测字形时作兜底。
   */
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

  constructor({ text, intensities = [], maxFontSize }: DeformerOptions) {
    this.text = text
    this.intensities = intensities.map(val => val / 100)
    // 变形半径基准：取文字里真实的最大字号。
    // 早期实现固定取外部传入的 maxFontSize（默认 100），任意字号的文字都按 100px 弯曲——
    // 半径不随字号缩放，于是字号一变形状就垮（缩放相关，小字被挤成竖条）。
    // 这里直接从已 measure 的字形读取真实最大字号，使变形对字号缩放保持不变；
    // maxFontSize 仅在无可测字形时作兜底。
    this.lineHeight = this._maxFontSize() || maxFontSize || 100
  }

  protected _maxFontSize(): number {
    let max = 0
    this.characters.forEach((character) => {
      if (character.glyphBox) {
        max = Math.max(max, character.fontSize)
      }
    })
    return max
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
          // 细分阈值随字号缩放（原固定 5px 是按 ~100px 字号调的：5/100）：
          // 小字时阈值变小→同样细分，避免小字弯曲不足而与大字形状不一致。
          if (curve instanceof LineCurve && curve.getLength() > this.lineHeight * 0.05) {
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
