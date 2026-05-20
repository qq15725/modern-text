import { Vector2 } from 'modern-path2d'

/**
 * 这些曲线类用于「逐字（-by-word）」沿形状排布文字。
 *
 * 旧版变形代码针对 `modern-path2d@0.2.5` 编写，该版本内置了
 * `CircleCurve` / `EllipseCurve` / `HeartCurve` / `PolygonCurve` / `RectangularCurve`，
 * 当前版本（1.6.x）已不再导出。这里从 0.2.5 原样移植其实现，
 * 仅做 Vector2 API 适配（`copy`→`copyFrom`、`new Vector2().lerpVectors`→`Vector2.lerp`），
 * 以保证逐字排布效果与原版一致。
 *
 * 仅保留 deformer 实际用到的方法：getPoint / getPointAt / getTangent / getNormal。
 */

abstract class ShapeCurve {
  arcLengthDivisions = 200
  protected _cacheArcLengths?: number[]
  protected _needsUpdate = false

  abstract getPoint(t: number, output?: Vector2): Vector2

  getPointAt(u: number, output = new Vector2()): Vector2 {
    return this.getPoint(this.getUToTMapping(u), output)
  }

  getLength(): number {
    const lengths = this.getLengths()
    return lengths[lengths.length - 1]
  }

  getLengths(divisions = this.arcLengthDivisions): number[] {
    if (this._cacheArcLengths && this._cacheArcLengths.length === divisions + 1 && !this._needsUpdate) {
      return this._cacheArcLengths
    }
    this._needsUpdate = false
    const cache: number[] = [0]
    let last = this.getPoint(0)
    let sum = 0
    for (let i = 1; i <= divisions; i++) {
      const current = this.getPoint(i / divisions)
      sum += current.distanceTo(last)
      cache.push(sum)
      last = current
    }
    this._cacheArcLengths = cache
    return cache
  }

  getUToTMapping(u: number, distance?: number): number {
    const lengths = this.getLengths()
    const lengthsLen = lengths.length
    const targetLength = distance === undefined ? u * lengths[lengthsLen - 1] : distance
    let low = 0
    let high = lengthsLen - 1
    let i = 0
    while (low <= high) {
      i = Math.floor(low + (high - low) / 2)
      const comparison = lengths[i] - targetLength
      if (comparison < 0) {
        low = i + 1
      }
      else if (comparison > 0) {
        high = i - 1
      }
      else {
        high = i
        break
      }
    }
    i = high
    if (lengths[i] === targetLength) {
      return i / (lengthsLen - 1)
    }
    const lengthBefore = lengths[i]
    const lengthAfter = lengths[i + 1]
    const segmentLength = lengthAfter - lengthBefore
    const segmentFraction = (targetLength - lengthBefore) / segmentLength
    return (i + segmentFraction) / (lengthsLen - 1)
  }

  getTangent(t: number, output = new Vector2()): Vector2 {
    const delta = 1e-4
    const t1 = Math.max(0, t - delta)
    const t2 = Math.min(1, t + delta)
    return output.copyFrom(this.getPoint(t2).sub(this.getPoint(t1)).normalize())
  }

  getNormal(t: number, output = new Vector2()): Vector2 {
    this.getTangent(t, output)
    return output.set(-output.y, output.x).normalize()
  }
}

/**
 * 分段曲线基类：由若干子曲线拼成，`getCurve(t)` 选中子曲线并把 `curveT` 设为其局部参数，
 * 其余取点/切线/法线统一委托给选中的子曲线。
 */
abstract class SegmentedCurve extends ShapeCurve {
  protected curveT = 0

  abstract getCurve(t: number): ShapeCurve

  getPoint(t: number, output = new Vector2()): Vector2 {
    return this.getCurve(t).getPoint(this.curveT, output)
  }

  getPointAt(u: number, output = new Vector2()): Vector2 {
    return this.getPoint(u, output)
  }

  getTangent(t: number, output = new Vector2()): Vector2 {
    return this.getCurve(t).getTangent(this.curveT, output)
  }

  getNormal(t: number, output = new Vector2()): Vector2 {
    return this.getCurve(t).getNormal(this.curveT, output)
  }
}

class LineShapeCurve extends ShapeCurve {
  constructor(public start: Vector2, public end: Vector2) {
    super()
  }

  getPoint(t: number, output = new Vector2()): Vector2 {
    if (t === 1) {
      output.copyFrom(this.end)
    }
    else {
      output.copyFrom(this.end).sub(this.start).scale(t).add(this.start)
    }
    return output
  }

  getPointAt(u: number, output = new Vector2()): Vector2 {
    return this.getPoint(u, output)
  }

  getTangent(_t: number, output = new Vector2()): Vector2 {
    return output.subVectors(this.end, this.start).normalize()
  }
}

export class CircleCurve extends ShapeCurve {
  constructor(public center: Vector2, public radius: number, public start = 0, public end = Math.PI * 2) {
    super()
  }

  getPoint(t: number, output = new Vector2()): Vector2 {
    return output.copyFrom(this.center).add(this.getNormal(t).scale(this.radius))
  }

  getTangent(t: number, output = new Vector2()): Vector2 {
    const { x, y } = this.getNormal(t)
    return output.set(-y, x)
  }

  getNormal(t: number, output = new Vector2()): Vector2 {
    const { start, end } = this
    const _t = t * (end - start) + start - 0.5 * Math.PI
    return output.set(Math.cos(_t), Math.sin(_t))
  }
}

export class EllipseCurve extends ShapeCurve {
  constructor(
    public center = new Vector2(),
    public radiusX = 1,
    public radiusY = 1,
    public rotation = 0,
    public startAngle = 0,
    public endAngle = Math.PI * 2,
    public clockwise = false,
  ) {
    super()
  }

  getPoint(t: number, output = new Vector2()): Vector2 {
    const twoPi = Math.PI * 2
    let deltaAngle = this.endAngle - this.startAngle
    const samePoints = Math.abs(deltaAngle) < Number.EPSILON
    while (deltaAngle < 0) {
      deltaAngle += twoPi
    }
    while (deltaAngle > twoPi) {
      deltaAngle -= twoPi
    }
    if (deltaAngle < Number.EPSILON) {
      deltaAngle = samePoints ? 0 : twoPi
    }
    if (this.clockwise && !samePoints) {
      deltaAngle = deltaAngle === twoPi ? -twoPi : deltaAngle - twoPi
    }
    const angle = this.startAngle + t * deltaAngle
    let x = this.center.x + this.radiusX * Math.cos(angle)
    let y = this.center.y + this.radiusY * Math.sin(angle)
    if (this.rotation !== 0) {
      const cos = Math.cos(this.rotation)
      const sin = Math.sin(this.rotation)
      const tx = x - this.center.x
      const ty = y - this.center.y
      x = tx * cos - ty * sin + this.center.x
      y = tx * sin + ty * cos + this.center.y
    }
    return output.set(x, y)
  }
}

export class HeartCurve extends SegmentedCurve {
  protected curves: ShapeCurve[] = []

  constructor(public center: Vector2, public size: number, public start = 0, public end = 1) {
    super()
    this.update()
  }

  update(): this {
    const { x, y } = this.center
    const c1Center = new Vector2(x + 0.5 * this.size, y - 0.5 * this.size)
    const c5Center = new Vector2(x - 0.5 * this.size, y - 0.5 * this.size)
    const c3Center = new Vector2(x, y + 0.5 * this.size)
    const curve1 = new CircleCurve(c1Center, Math.SQRT1_2 * this.size, -0.25 * Math.PI, 0.75 * Math.PI)
    const curve5 = new CircleCurve(c5Center, Math.SQRT1_2 * this.size, -0.75 * Math.PI, 0.25 * Math.PI)
    const curve3 = new CircleCurve(c3Center, 0.5 * Math.SQRT1_2 * this.size, 0.75 * Math.PI, 1.25 * Math.PI)
    const bottom = new Vector2(x, y + this.size)
    const right = new Vector2(x + this.size, y)
    const rightInner = Vector2.lerp(right, bottom, 0.75)
    const left = new Vector2(x - this.size, y)
    const leftInner = Vector2.lerp(left, bottom, 0.75)
    const curve2 = new LineShapeCurve(right, rightInner)
    const curve4 = new LineShapeCurve(leftInner, left)
    this.curves = [curve1, curve2, curve3, curve4, curve5]
    return this
  }

  getCurve(t: number): ShapeCurve {
    let val = (t * (this.end - this.start) + this.start) % 1
    if (val < 0) {
      val += 1
    }
    val *= 9 * Math.PI / 8 + 1.5
    const PI_1_2 = 0.5 * Math.PI
    let index: number
    if (val < PI_1_2) {
      index = 0
      this.curveT = val / PI_1_2
    }
    else if (val < PI_1_2 + 0.75) {
      index = 1
      this.curveT = (val - PI_1_2) / 0.75
    }
    else if (val < 5 * Math.PI / 8 + 0.75) {
      index = 2
      this.curveT = (val - PI_1_2 - 0.75) / (Math.PI / 8)
    }
    else if (val < 5 * Math.PI / 8 + 1.5) {
      index = 3
      this.curveT = (val - 5 * Math.PI / 8 - 0.75) / 0.75
    }
    else {
      index = 4
      this.curveT = (val - 5 * Math.PI / 8 - 1.5) / PI_1_2
    }
    return this.curves[index]
  }
}

export class PolygonCurve extends SegmentedCurve {
  protected curves: LineShapeCurve[] = []
  protected points: Vector2[] = []

  constructor(public center: Vector2, public radius = 0, public number = 0, public start = 0, public end = 1) {
    super()
    this.update()
  }

  update(): this {
    for (let i = 0; i < this.number; i++) {
      let radian = i * 2 * Math.PI / this.number
      radian -= 0.5 * Math.PI
      this.points.push(
        new Vector2(this.radius * Math.cos(radian), this.radius * Math.sin(radian)).add(this.center),
      )
    }
    for (let i = 0; i < this.number; i++) {
      this.curves.push(new LineShapeCurve(this.points[i], this.points[(i + 1) % this.number]))
    }
    return this
  }

  getCurve(t: number): LineShapeCurve {
    let pos = (t * (this.end - this.start) + this.start) % 1
    if (pos < 0) {
      pos += 1
    }
    const v = pos * this.number
    const index = Math.floor(v)
    this.curveT = v - index
    return this.curves[index]
  }
}

export class RectangularCurve extends SegmentedCurve {
  protected curves: LineShapeCurve[] = []

  constructor(public center: Vector2, public rx: number, public aspectRatio = 1, public start = 0, public end = 1) {
    super()
    this.update()
  }

  update(): this {
    const { x, y } = this.center
    const offsetX = this.rx
    const offsetY = this.rx / this.aspectRatio
    const points = [
      new Vector2(x - offsetX, y - offsetY),
      new Vector2(x + offsetX, y - offsetY),
      new Vector2(x + offsetX, y + offsetY),
      new Vector2(x - offsetX, y + offsetY),
    ]
    for (let i = 0; i < 4; i++) {
      this.curves.push(new LineShapeCurve(points[i].clone(), points[(i + 1) % 4].clone()))
    }
    return this
  }

  getCurve(t: number): LineShapeCurve {
    let current = (t * (this.end - this.start) + this.start) % 1
    if (current < 0) {
      current += 1
    }
    current *= (1 + this.aspectRatio) * 2
    let i: number
    if (current < this.aspectRatio) {
      i = 0
      this.curveT = current / this.aspectRatio
    }
    else if (current < this.aspectRatio + 1) {
      i = 1
      this.curveT = current - this.aspectRatio
    }
    else if (current < 2 * this.aspectRatio + 1) {
      i = 2
      this.curveT = (current - this.aspectRatio - 1) / this.aspectRatio
    }
    else {
      i = 3
      this.curveT = current - 2 * this.aspectRatio - 1
    }
    return this.curves[i]
  }
}
