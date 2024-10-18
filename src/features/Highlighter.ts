import type { Path2D } from 'modern-path2d'
import type { Character } from '../content'
import type { FragmentHighlight } from '../types'
import { BoundingBox, Matrix3, parseSvg, parseSvgToDom, Vector2 } from 'modern-path2d'
import { drawPaths } from '../canvas'
import { Feature } from './Feature'

interface HighlightGroup {
  url: string
  box: BoundingBox
  baseline: number
  fontSize: number
  fontMinGlyphWidth: number
}

export class Highlighter extends Feature {
  paths: Path2D[] = []

  getBoundingBox(): BoundingBox {
    if (!this.paths.length) {
      return new BoundingBox()
    }
    const min = Vector2.MAX
    const max = Vector2.MIN
    this.paths.forEach(path => path.getMinMax(min, max))
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
          fontMinGlyphWidth: characters[0].fontMinGlyphWidth,
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

  protected _parseGroup(group: HighlightGroup): Path2D[] {
    const { url, box: groupBox, baseline, fontSize, fontMinGlyphWidth } = group
    const { box, viewBox, paths } = this._parseSvg(url)
    const result: Path2D[] = []
    const type = box.height / viewBox.height > 0.3 ? 0 : 1

    function transformPathStyle(path: Path2D): void {
      const rate = fontSize * 0.03
      if (path.style.strokeWidth) {
        path.style.strokeWidth *= rate
      }
      if (path.style.strokeMiterlimit) {
        path.style.strokeMiterlimit *= rate
      }
      if (path.style.strokeDashoffset) {
        path.style.strokeDashoffset *= rate
      }
      if (path.style.strokeDasharray) {
        path.style.strokeDasharray = path.style.strokeDasharray.map(v => v * rate)
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
        transformPathStyle(path)
        result.push(path)
      })
    }
    else if (type === 1) {
      const scale = fontMinGlyphWidth / box.width
      const width = box.width * scale
      const length = Math.ceil(groupBox.width / width)
      const totalWidth = width * length
      const offset = {
        x: groupBox.left + (groupBox.width - totalWidth) / 2,
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
          transformPathStyle(path)
          result.push(path)
        })
      }
    }
    return result
  }

  draw({ ctx }: { ctx: CanvasRenderingContext2D }): this {
    drawPaths({
      ctx,
      paths: this.paths,
      fontSize: this._text.computedStyle.fontSize,
    })
    return this
  }
}
