import { CubicBezierCurve, LineCurve, QuadraticBezierCurve, Vector2 } from 'modern-path2d'
import { describe, expect, it } from 'vitest'
import { HeartCurve, PolygonCurve, RectangularCurve, splitCurve } from '../src/plugins/deformers'

function isFinitePoint(p: { x: number, y: number }): boolean {
  return Number.isFinite(p.x) && Number.isFinite(p.y)
}

describe('deformer curves', () => {
  it('polygonCurve places t on each polygon edge (vertices at t = i/n)', () => {
    const curve = new PolygonCurve(new Vector2(0, 0), 50, 5, 0, 1)
    // 五边形从正上方顶点开始（-90°），逐字 t 均分到 5 条边
    const top = curve.getPointAt(0)
    expect(top.x).toBeCloseTo(0, 5)
    expect(top.y).toBeCloseTo(-50, 5)
    // t = 1/5 命中第二个顶点（-90° + 72° = -18°）
    const v1 = curve.getPointAt(0.2)
    expect(v1.x).toBeCloseTo(50 * Math.cos(-Math.PI / 2 + (2 * Math.PI) / 5), 4)
    expect(v1.y).toBeCloseTo(50 * Math.sin(-Math.PI / 2 + (2 * Math.PI) / 5), 4)
    for (let t = 0; t <= 1; t += 0.1) {
      expect(isFinitePoint(curve.getTangent(t))).toBe(true)
      expect(isFinitePoint(curve.getNormal(t))).toBe(true)
    }
  })

  it('rectangularCurve derives finite point/tangent', () => {
    const curve = new RectangularCurve(new Vector2(10, 20), 40, 0.5, 0, 1)
    expect(isFinitePoint(curve.getPointAt(0.5))).toBe(true)
    expect(isFinitePoint(curve.getTangent(0.5))).toBe(true)
  })

  it('heartCurve derives finite point/normal', () => {
    const curve = new HeartCurve(new Vector2(0, 0), 100, 1, 0)
    expect(isFinitePoint(curve.getPointAt(0.3))).toBe(true)
    expect(isFinitePoint(curve.getNormal(0.3))).toBe(true)
  })
})

describe('splitCurve', () => {
  it('splits a LineCurve crossing x', () => {
    const line = new LineCurve(new Vector2(-10, 0), new Vector2(10, 6))
    const parts = splitCurve(line, { x: 0 })
    expect(parts.length).toBe(2)
    expect(parts[0]).toBeInstanceOf(LineCurve)
  })

  it('splits a QuadraticBezierCurve crossing y', () => {
    const q = new QuadraticBezierCurve(new Vector2(0, -10), new Vector2(5, -5), new Vector2(10, 10))
    const parts = splitCurve(q, { y: 0 })
    expect(parts.length).toBe(2)
    expect(parts[0]).toBeInstanceOf(QuadraticBezierCurve)
  })

  it('returns the curve unchanged when it does not cross', () => {
    const line = new LineCurve(new Vector2(1, 1), new Vector2(5, 5))
    const parts = splitCurve(line, { x: 100 })
    expect(parts.length).toBe(1)
  })

  it('splits a CubicBezierCurve crossing x', () => {
    const c = new CubicBezierCurve(
      new Vector2(-10, 0),
      new Vector2(-5, 8),
      new Vector2(5, -8),
      new Vector2(10, 0),
    )
    const parts = splitCurve(c, { x: 0 })
    expect(parts.length).toBe(2)
  })
})
