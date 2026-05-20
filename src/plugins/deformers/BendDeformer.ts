import type { DeformerOptions } from './Deformer'
import type { BendPreset } from './types'
import { Deformer } from './Deformer'

/** Bend 引擎：整体弯曲。弯曲几何在此算好,具体坐标变换由 preset.transform 提供。 */
export class BendDeformer extends Deformer {
  constructor(options: DeformerOptions, public preset: BendPreset) {
    super(options)
  }

  deform(): void {
    if (!Math.hypot(...this.intensities)) {
      return
    }
    this._lineToQuadraticBezier()
    this._bend()
    this._makeTheJointSmooth()
  }

  protected _bend(): void {
    const { boundingBox, baseWidth, baseHeight, preset } = this
    const lineHeight = (this.lineHeight * 2) / Math.sin(this.intensities[0] * Math.PI * 0.5)
    const isVertical = preset.vertical === undefined || preset.vertical === 'auto'
      ? !this.isHorizontal
      : preset.vertical
    const { left, top, width, height } = boundingBox
    const size = (isVertical ? height : width) / 2 / lineHeight
    const center = {
      x: left + width / 2,
      y: top + height / 2,
    }
    let centerDistAngle: number
    const centerDist = { x: center.x, y: center.y }
    if (isVertical) {
      centerDistAngle = 0
      centerDist.x -= baseHeight / 2 / Math.tan(size) + (Math.sign(size) * width) / 2
    }
    else {
      centerDistAngle = 1.5 * Math.PI
      centerDist.y += baseWidth / 2 / Math.tan(size) + (Math.sign(size) * height) / 2
    }
    const method = preset.transform({
      lineHeight,
      size,
      center,
      centerDist,
      centerDistAngle,
      width,
      height,
      isHorizontal: this.isHorizontal,
    })
    this._transform(method)
  }
}
