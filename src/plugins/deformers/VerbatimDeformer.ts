import type { Character } from '../../content'
import type { DeformerOptions } from './Deformer'
import type { CurvePreset, OffsetPreset, VerbatimContext } from './types'
import { Vector2 } from 'modern-path2d'
import { Deformer } from './Deformer'

/**
 * 逐字引擎：每个字符独立位移/旋转(offset),或沿一条曲线排布(curve)。
 * 排布机制在此,具体偏移公式 / 曲线由 preset 提供。
 */
export class VerbatimDeformer extends Deformer {
  constructor(options: DeformerOptions, public preset: CurvePreset | OffsetPreset) {
    super(options)
  }

  protected _context(): VerbatimContext {
    return {
      intensities: this.intensities,
      baseWidth: this.baseWidth,
      lineHeight: this.lineHeight,
      isHorizontal: this.isHorizontal,
      boundingBox: this.boundingBox,
    }
  }

  deform(): void {
    if (!Math.hypot(...this.intensities)) {
      return
    }
    const { preset } = this
    const ctx = this._context()
    if (preset.engine === 'offset') {
      this._transform(
        preset.point,
        preset.perChar ? (info: any) => preset.perChar!(ctx, info) : undefined,
      )
    }
    else {
      const followTangent = preset.followTangent ?? true
      const { funcPerChar, funcPerPoint } = this._getPerCharAndPointFunc(followTangent)
      this._transform(funcPerPoint, funcPerChar, () => {
        const { width, height, left, top } = this.boundingBox
        return {
          width,
          height,
          left,
          top,
          curve: preset.makeCurve(ctx),
          isHorizontal: this.isHorizontal,
          needExpandAlongNormal: preset.expandAlongNormal ?? false,
        }
      })
    }
  }

  protected _getPerCharAndPointFunc(rotate = false): { funcPerPoint: any, funcPerChar: any } {
    let funcPerChar
    let funcPerPoint
    if (rotate) {
      funcPerPoint = this._resetPointPos
      funcPerChar = this._calculateNewCenter
    }
    else {
      funcPerPoint = this._resetPointPosWithoutRotate
      funcPerChar = this._calculateNewCenterWithoutRotate
    }
    return {
      funcPerPoint,
      funcPerChar,
    }
  }

  protected _calculateNewCenter({ character }: { character: Character }, arg: any): { cos: number, sin: number, newCenter: Vector2, center: Vector2 } {
    const { width, height, left, top, curve, isHorizontal, needExpandAlongNormal = false } = arg
    const { center, centerDiviation } = character
    const pos = isHorizontal ? (center.x - left) / width : (center.y - top) / height
    const a = isHorizontal ? new Vector2(0, center.y - top) : new Vector2(center.x - left, 0)
    if (needExpandAlongNormal) {
      const p = curve.getNormal(pos)
      a.x += p.x * -centerDiviation
      a.y += p.y * -centerDiviation
    }
    const newCenter = curve.getPointAt(pos).add(a)
    const tangent = curve.getTangent(pos)
    const cos = tangent.x
    const sin = tangent.y
    return {
      cos,
      sin,
      newCenter,
      center,
    }
  }

  protected _calculateNewCenterWithoutRotate({ character }: { character: Character }, arg: any): { newCenter: Vector2, center: Vector2 } {
    const { width, height, left, top, curve, isHorizontal } = arg
    const { center } = character
    const pos = isHorizontal ? (center.x - left) / width : (center.y - top) / height
    const offsetPoint = isHorizontal ? new Vector2(0, center.y - top) : new Vector2(center.x - left, 0)
    return {
      newCenter: curve.getPointAt(pos).add(offsetPoint),
      center,
    }
  }

  protected _resetPointPos(point: { x: number, y: number }, arg: any): number[] {
    const { cos = 1, sin = 0, center, newCenter } = arg
    const dx = point.x - center.x
    const dy = point.y - center.y
    const x = newCenter.x + dx * cos - dy * sin
    const y = newCenter.y + dx * sin + dy * cos
    return [x, y]
  }

  protected _resetPointPosWithoutRotate(point: { x: number, y: number }, arg: any): number[] {
    const { center, newCenter } = arg
    const x = point.x - center.x + newCenter.x
    const y = point.y - center.y + newCenter.y
    return [x, y]
  }
}
