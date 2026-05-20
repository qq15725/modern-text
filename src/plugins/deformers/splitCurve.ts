import type { Curve } from 'modern-path2d'
import { CubicBezierCurve, LineCurve, QuadraticBezierCurve, Vector2 } from 'modern-path2d'

export function splitCurve(curve: Curve, point: { x?: number, y?: number }): Curve[] {
  let { x, y } = point
  if (curve instanceof QuadraticBezierCurve) {
    const { p1: v0, cp: v1, p2: v2 } = curve
    const s = x !== undefined && Math.abs(Math.sign(v0.x - x) + Math.sign(v1.x - x) + Math.sign(v2.x - x)) === 1
    const n = y !== undefined && Math.abs(Math.sign(v0.y - y) + Math.sign(v1.y - y) + Math.sign(v2.y - y)) === 1
    let o, e, dist, c
    if (s) {
      o = v0.x - 2 * v1.x + v2.x
      e = 2 * (-v0.x + v1.x)
      dist = v0.x - x!
    }
    if (n) {
      o = v0.y - 2 * v1.y + v2.y
      e = 2 * (-v0.y + v1.y)
      dist = v0.y - y!
    }
    if (s || n) {
      c = e! * e! - 4 * o! * dist!
      if (c > 0) {
        const h = Math.sqrt(c)
        const a = (-e! + h) / 2 / o!
        const b = (-e! - h) / 2 / o!
        const u = [a, b].find(v => v > 0 && v < 1)
        if (u) {
          const r = Vector2.lerp(v0, v1, u)
          const d = Vector2.lerp(v1, v2, u)
          const B = Vector2.lerp(r, d, u)
          return [new QuadraticBezierCurve(v0, r, B), new QuadraticBezierCurve(B.clone(), d, v2)]
        }
      }
    }
  }
  else if (curve instanceof CubicBezierCurve) {
    const { p1: v0, cp1: v1, cp2: v2, p2: v3 } = curve
    const { min, max } = curve.getMinMax()
    const e = x !== undefined && (min.x - x) * (max.x - x) < 0
    const l = y !== undefined && (min.y - y) * (max.y - y) < 0
    if (e || l) {
      x = 0.5 * v0.x + 0.5 * v1.x
      y = 0.5 * v0.y + 0.5 * v1.y
      const c = new Vector2(x, y)
      x = 0.25 * v0.x + 0.5 * v1.x + 0.25 * v2.x
      y = 0.25 * v0.y + 0.5 * v1.y + 0.25 * v2.y
      const h = new Vector2(x, y)
      x = 0.125 * v0.x + 0.375 * v1.x + 0.375 * v2.x + 0.125 * v3.x
      y = 0.125 * v0.y + 0.375 * v1.y + 0.375 * v2.y + 0.125 * v3.y
      const a = new Vector2(x, y)
      x = 0.25 * v1.x + 0.5 * v2.x + 0.25 * v3.x
      y = 0.25 * v1.y + 0.5 * v2.y + 0.25 * v3.y
      const b = new Vector2(x, y)
      x = 0.5 * v2.x + 0.5 * v3.x
      y = 0.5 * v2.y + 0.5 * v3.y
      const u = new Vector2(x, y)
      return [new CubicBezierCurve(v0, c, h, a), new CubicBezierCurve(a.clone(), b, u, v3)]
    }
  }
  else if (curve instanceof LineCurve) {
    const { p1: v1, p2: v2 } = curve
    const changedX = x !== undefined && (v1.x - x) * (v2.x - x) < 0
    const changedY = y !== undefined && (v1.y - y) * (v2.y - y) < 0
    if (changedX) {
      y = v1.y + ((v2.y - v1.y) / (v2.x - v1.x)) * (x! - v1.x)
    }
    if (changedY) {
      x = v1.x + ((v2.x - v1.x) / (v2.y - v1.y)) * (y! - v1.y)
    }
    if (changedX || changedY) {
      return [new LineCurve(v1, new Vector2(x!, y!)), new LineCurve(new Vector2(x!, y!), v2)]
    }
  }
  return [curve]
}
