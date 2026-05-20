import type { Vector2Like } from 'modern-path2d'
import type { DeformerOptions } from './Deformer'
import type { FfdPreset } from './types'
import { Vector2 } from 'modern-path2d'
import { Deformer } from './Deformer'

/** FFD 引擎：自由变形。网格生成与贝塞尔/线性计算在此,具体控制点位移由 preset.build 提供。 */
export class FfdDeformer extends Deformer {
  constructor(options: DeformerOptions, public preset: FfdPreset) {
    super(options)
  }

  deform(): void {
    if (!Math.hypot(...this.intensities)) {
      return
    }
    const { preset } = this
    if (preset.breakLine) {
      this._breakLine()
    }
    if (preset.lineToQuad) {
      this._lineToQuadraticBezier()
    }
    const [a, b] = this.intensities
    const points = this._createFFDControlPoints(preset.hBlocks, preset.vBlocks)
    preset.build(points, {
      a,
      b,
      baseWidth: this.baseWidth,
      baseHeight: this.baseHeight,
      lineHeight: this.lineHeight,
      adjust: (point, dx, dy) => this._adjustControlPoints(point, { x: dx, y: dy }),
    })
    if (preset.bezier) {
      this._calculateForBezierFFD(points, preset.hBlocks, preset.vBlocks)
      this._makeTheJointSmooth()
    }
    else {
      this._calculateForLinearFFD(points, preset.hBlocks, preset.vBlocks)
    }
  }

  protected _calculateForFFD(cb: any, points: Vector2[], hBlocks: number, vBlocks: number): void {
    const { left, top, right, width, height } = this.boundingBox
    this._transform(
      this.isHorizontal
        ? (point: Vector2Like) => {
            const xProgress = (point.x - left) / width
            const yProgress = (point.y - top) / height
            let [x, y] = [0, 0]
            for (let h = 0; h < hBlocks + 2; h++) {
              const _h = cb(hBlocks, h, xProgress)
              for (let v = 0; v < vBlocks + 2; v++) {
                const _v = cb(vBlocks, v, yProgress)
                const p = points[h * (vBlocks + 2) + v]
                x += _h * _v * p.x
                y += _h * _v * p.y
              }
            }
            return [x, y]
          }
        : (point: Vector2Like) => {
            const xProgress = (right - point.x) / width
            const yProgress = (point.y - top) / height
            let [x, y] = [0, 0]
            for (let h = 0; h < hBlocks + 2; h++) {
              const _h = cb(hBlocks, h, yProgress)
              for (let v = 0; v < vBlocks + 2; v++) {
                const _v = cb(vBlocks, v, xProgress)
                const p = points[h * (vBlocks + 2) + v]
                x += _h * _v * p.x
                y += _h * _v * p.y
              }
            }
            return [x, y]
          },
    )
  }

  protected _createFFDControlPoints(hBlocks: number, vBlocks: number): Vector2[] {
    const { left, top, right, width, height } = this.boundingBox
    const points: Vector2[] = []
    if (this.isHorizontal) {
      const avgWidth = width / (hBlocks + 1)
      const avgHeight = height / (vBlocks + 1)
      for (let h = 0; h < hBlocks + 2; h++) {
        for (let v = 0; v < vBlocks + 2; v++) {
          points.push(new Vector2(left + h * avgWidth, top + v * avgHeight))
        }
      }
    }
    else {
      const avgWidth = width / (vBlocks + 1)
      const avgHeight = height / (hBlocks + 1)
      for (let h = 0; h < hBlocks + 2; h++) {
        for (let v = 0; v < vBlocks + 2; v++) {
          points.push(new Vector2(right - v * avgWidth, top + h * avgHeight))
        }
      }
    }
    return points
  }

  protected _adjustControlPoints(point1: Vector2Like, point2: Vector2Like): void {
    if (this.isHorizontal) {
      point1.x += point2.x
      point1.y += point2.y
    }
    else {
      point1.x -= point2.y
      point1.y += point2.x
    }
  }

  protected _factorialForFFD(val: number): number {
    let result = 1
    for (let i = 2; i <= val; i++) {
      result *= i
    }
    return result
  }

  protected _combineForFFD(total: number, current: number): number {
    return this._factorialForFFD(total) / this._factorialForFFD(total - current) / this._factorialForFFD(current)
  }

  protected _calculateForBezierFFD(points: Vector2[], hBlocks: number, vBlocks: number): void {
    this._calculateForFFD(
      (count: number, current: number, progress: number) => {
        return (
          this._combineForFFD(count + 1, current)
          * (1 - progress) ** (count + 1 - current)
          * progress ** current
        )
      },
      points,
      hBlocks,
      vBlocks,
    )
  }

  protected _linearBasis(count: number, current: number, progress: number): number {
    const t = current < progress * count ? current + 1 - progress * count : progress * count - current + 1
    return Math.max(0, t)
  }

  protected _calculateForLinearFFD(points: Vector2[], hBlocks: number, vBlocks: number): void {
    this._calculateForFFD(
      (count: number, current: number, progress: number) => {
        return this._linearBasis(count + 1, current, progress)
      },
      points,
      hBlocks,
      vBlocks,
    )
  }
}
