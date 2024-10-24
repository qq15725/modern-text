import type { Path2D } from 'modern-path2d'
import type { Character } from '../content'
import type { FragmentHighlight } from '../types'
import { BoundingBox, Matrix3, parseSvg, parseSvgToDom, Vector2 } from 'modern-path2d'
import { drawPath } from '../canvas'
import { Feature } from './Feature'

interface HighlightGroup {
  url: string
  box: BoundingBox
  baseline: number
  fontSize: number
}

export class Highlighter extends Feature {
  paths: { clipRect?: BoundingBox, path: Path2D }[] = []

  getBoundingBox(): BoundingBox | undefined {
    if (!this.paths.length) {
      return undefined
    }
    const min = Vector2.MAX
    const max = Vector2.MIN
    this.paths.forEach(v => v.path.getMinMax(min, max))
    return new BoundingBox(min.x, min.y, max.x - min.x, max.y - min.y)
  }

  highlight(): void {
    const { characters } = this._text
    let group: Character[]
    const groups: Character[][] = []
    let prevHighlight: FragmentHighlight | undefined
    characters.forEach((character) => {
      const highlight = character.parent.highlight
      if (highlight?.url) {
        if (
          prevHighlight?.url === highlight.url
          && (
            group.length
            && group[0].boundingBox.top === character.boundingBox.top
            && group[0].fontSize === character.fontSize
          )
        ) {
          group.push(character)
        }
        else {
          group = []
          group.push(character)
          groups.push(group)
        }
      }
      prevHighlight = highlight
    })
    this.paths = groups
      .filter(characters => characters.length)
      .map((characters) => {
        return {
          url: characters[0]!.parent.highlight!.url,
          box: BoundingBox.from(...characters.map(c => c.boundingBox)),
          baseline: Math.max(...characters.map(c => c.baseline)),
          fontSize: characters[0].fontSize,
        }
      })
      .map(group => this._parseGroup(group))
      .flat()
  }

  protected _parseSvg(url: string): { paths: Path2D[], box: BoundingBox, viewBox: BoundingBox } {
    const svg = parseSvgToDom(url)
    const paths = parseSvg(svg)
    const min = Vector2.MAX
    const max = Vector2.MIN
    paths.forEach(path => path.getMinMax(min, max))
    return {
      paths,
      box: new BoundingBox(min.x, min.y, max.x - min.x, max.y - min.y),
      viewBox: new BoundingBox(...svg.getAttribute('viewBox')!.split(' ').map(Number)),
    }
  }

  protected _parseGroup(group: HighlightGroup): { clipRect?: BoundingBox, path: Path2D }[] {
    const { url, box: groupBox, baseline, fontSize } = group
    const { box, viewBox, paths } = this._parseSvg(url)
    const centerY = viewBox.top + viewBox.height / 2
    const result: { clipRect?: BoundingBox, path: Path2D }[] = []
    const type = centerY > box.top ? 0 : 1

    function transformPathStyle(path: Path2D, scale: number): void {
      if (path.style.strokeWidth) {
        path.style.strokeWidth *= scale
      }
      if (path.style.strokeMiterlimit) {
        path.style.strokeMiterlimit *= scale
      }
      if (path.style.strokeDashoffset) {
        path.style.strokeDashoffset *= scale
      }
      if (path.style.strokeDasharray) {
        path.style.strokeDasharray = path.style.strokeDasharray.map(v => v * scale)
      }
    }

    if (type === 0) {
      const offset = {
        x: groupBox.left - fontSize * 0.2,
        y: groupBox.top,
      }
      const scaleX = (groupBox.width + fontSize * 0.2 * 2) / box.width
      const scaleY = groupBox.height / box.height
      const m = new Matrix3()
        .translate(-box.x, -box.y)
        .scale(scaleX, scaleY)
        .translate(offset.x, offset.y)
      paths.forEach((original) => {
        const path = original.clone().transform(m)
        transformPathStyle(path, scaleX)
        result.push({ path })
      })
    }
    else if (type === 1) {
      const scale = fontSize / box.width
      const width = box.width * scale
      const length = Math.ceil(groupBox.width / width)
      const offset = {
        x: groupBox.left,
        y: groupBox.top + baseline + fontSize * 0.1,
      }
      const m = new Matrix3()
        .translate(-box.x, -box.y)
        .scale(scale, scale)
        .translate(offset.x, offset.y)
      for (let i = 0; i < length; i++) {
        const _m = m.clone().translate(i * width, 0)
        paths.forEach((original) => {
          const path = original.clone().transform(_m)
          transformPathStyle(path, scale)
          result.push({ clipRect: groupBox, path })
        })
      }
    }
    return result
  }

  draw({ ctx }: { ctx: CanvasRenderingContext2D }): this {
    this.paths.forEach((v) => {
      drawPath({
        ctx,
        path: v.path,
        clipRect: v.clipRect,
        fontSize: this._text.computedStyle.fontSize,
      })
    })
    return this
  }
}
