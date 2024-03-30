export class BoundingBox {
  get left() { return this.x }
  get top() { return this.y }
  get right() { return this.x + this.width }
  get bottom() { return this.y + this.height }

  constructor(
    public x = 0,
    public y = 0,
    public width = 0,
    public height = 0,
  ) {
    //
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
    return new BoundingBox(
      merged.x,
      merged.y,
      merged.right - merged.x,
      merged.bottom - merged.y,
    )
  }

  rotate90deg() {
    const { width, height } = this
    this.width = height
    this.height = width
  }

  translate(tx: number, ty: number): this {
    this.x += tx
    this.y += ty
    return this
  }

  clone() {
    return new BoundingBox(
      this.x,
      this.y,
      this.width,
      this.height,
    )
  }

  toArray(): [number, number, number, number] {
    return [this.x, this.y, this.width, this.height]
  }
}

