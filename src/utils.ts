import type { Path2D } from 'modern-path2d'
import { BoundingBox, Vector2 } from 'modern-path2d'

export function getPathsBoundingBox(paths: Path2D[]): BoundingBox | undefined {
  if (!paths.length) {
    return undefined
  }
  const min = Vector2.MAX
  const max = Vector2.MIN
  paths.forEach(path => path.getMinMax(min, max))
  return new BoundingBox(min.x, min.y, max.x - min.x, max.y - min.y)
}

export function filterEmpty(val: Record<string, any> | undefined): Record<string, any> | undefined {
  if (!val)
    return val
  const res: Record<string, any> = {}
  for (const key in val) {
    if (val[key] !== '' && val[key] !== undefined) {
      res[key] = val[key]
    }
  }
  return res
}
