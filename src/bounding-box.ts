export interface BoundingBoxOptions {
  x?: number
  y?: number
  width?: number
  height?: number
}

export class BoundingBox {
  x: number
  y: number
  width: number
  height: number
  get left() { return this.x }
  get top() { return this.y }
  get right() { return this.x + this.width }
  get bottom() { return this.y + this.height }

  constructor({ x = 0, y = 0, width = 0, height = 0 }: BoundingBoxOptions = {}) {
    this.x = x
    this.y = y
    this.width = width
    this.height = height
  }

  static from(...boxes: Array<BoundingBox>): BoundingBox {
    const firstBox = boxes[0]
    const merged = boxes.slice(1).reduce((merged, box) => {
      merged.x = Math.min(merged.x, box.x)
      merged.y = Math.min(merged.y, box.y)
      merged.right = Math.max(merged.right, box.right)
      merged.bottom = Math.max(merged.bottom, box.bottom)
      return merged
    }, { x: firstBox.x, y: firstBox.y, right: firstBox.right, bottom: firstBox.bottom })
    return new BoundingBox({
      x: merged.x,
      y: merged.y,
      width: merged.right - merged.x,
      height: merged.bottom - merged.y,
    })
  }

  move(tx: number, ty: number): this {
    this.x += tx
    this.y += ty
    return this
  }

  clone() {
    return new BoundingBox({
      x: this.x,
      y: this.y,
      width: this.width,
      height: this.height,
    })
  }
}

