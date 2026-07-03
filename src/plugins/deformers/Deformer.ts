import type { Character, Paragraph } from '../../content'
import type { Text } from '../../Text'
import { BoundingBox, LineCurve, QuadraticBezierCurve, Vector2 } from 'modern-path2d'
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
  /**
   * 变形域用「文字自然内容框」(inlineBox) 而非「行框」(lineBox=元素框)。
   * 默认 false（历史行为：变形随元素框宽拉伸/压缩，框窄会把字压重叠）。
   * 置 true 后变形恒按内容自然尺寸规范渲染、与元素选框解耦——宿主可把选框自由设为变形后视觉 bbox，
   * 既贴合又不重叠、不发散。
   */
  autoWidth?: boolean
}

export abstract class Deformer {
  declare text: Text
  declare intensities: number[]
  declare lineHeight: number
  /** 见 DeformerOptions.autoWidth */
  autoWidth = false
  /** autoWidth 下缓存本次变形的「干净字形内容框」（首次访问=变形前算，之后 deform 会改写字形，须缓存） */
  protected _contentBox?: BoundingBox

  get boundingBox(): BoundingBox {
    if (!this.autoWidth) {
      return this.text.lineBox
    }
    // autoWidth：变形域用「文字自然内容框」= 变形前全部字符干净字形盒(glyphBox)的并集。
    // 与元素选框完全解耦（选框宽高被 mce 绑成 lineBox，框窄会压重叠），故变形恒按内容规范渲染。
    // 关键点：
    //  1) 必须**包住全部字形点**——FFD 是网格插值，字形点若超出域(progress>1)会被外插 → 撕裂
    //     （之前用 advanceWidth 之和作宽、字号作高，高度<字形底部 → 末字撕裂，就是这个坑）。
    //  2) glyphBox 会被 deform 原地改写，故只在**首次访问时**（deform 尚未改字形）算并缓存；
    //     deformer 每次变形都是新实例，缓存天然是「本次变形」的干净框。
    // 2D 闭合形状(engine='curve')由 deformation 插件强制关掉 autoWidth（需近方元素框，不走这里）。
    if (!this._contentBox) {
      const boxes = this.characters.map(c => c.glyphBox).filter(Boolean)
      const lb = this.text.lineBox
      this._contentBox = boxes.length ? BoundingBox.from(...boxes) : new BoundingBox(lb.left, lb.top, lb.width, lb.height)
    }
    return this._contentBox
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

  constructor({ text, intensities = [], maxFontSize, autoWidth = false }: DeformerOptions) {
    this.text = text
    this.autoWidth = autoWidth
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
          // 只更新 glyphBox（变形后的字形框，供 boundingBox / 渲染定位）。不写 inlineBox：
          // inlineBox 是布局位置、被增量布局复用，变形若污染它，下一帧就会基于错位再变形。
          character.glyphBox = character.getGlyphBoundingBox()
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
