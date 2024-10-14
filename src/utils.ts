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

export function getRotationPoint(point: any, rotation: number): { x: number, y: number } {
  const { x, y } = point
  const sin = Math.sin(rotation)
  const cos = Math.cos(rotation)
  return {
    x: x * cos - y * sin,
    y: x * sin + y * cos,
  }
}

export function getSkewPoint(point: any, startPoint: any, skewX: number, skewY: number): { x: number, y: number } {
  const dx = point.x - startPoint.x
  const dy = point.y - startPoint.y
  return {
    x: startPoint.x + (dx + Math.tan(skewX) * dy),
    y: startPoint.y + (dy + Math.tan(skewY) * dx),
  }
}

export function getScalePoint(point: any, startPoint: any, scaleX: number, scaleY: number): { x: number, y: number } {
  const x = scaleX < 0 ? startPoint.x - point.x + startPoint.x : point.x
  const y = scaleY < 0 ? startPoint.y - point.y + startPoint.y : point.y
  return {
    x: x * Math.abs(scaleX),
    y: y * Math.abs(scaleY),
  }
}

export function getPointPosition(
  point: { x: number, y: number },
  startPoint: { x: number, y: number },
  rotation = 0,
  skewX = 0,
  skewY = 0,
  scaleX = 1,
  scaleY = 1,
): { x: number, y: number } {
  let points = Array.isArray(point) ? point : [point]
  const _rotation = (-rotation / 180) * Math.PI
  const { x, y } = startPoint
  if (scaleX !== 1 || scaleY !== 1) {
    points = points.map((point) => {
      return getScalePoint(point, startPoint, scaleX, scaleY)
    })
  }
  if (skewX || skewY) {
    points = points.map((point) => {
      return getSkewPoint(point, startPoint, skewX, skewY)
    })
  }
  points = points.map((d) => {
    const h = d.x - x
    const f = -(d.y - y)
    d = getRotationPoint({ x: h, y: f }, _rotation)
    return {
      x: x + d.x,
      y: y - d.y,
    }
  })
  return points[0]
}
