import type { Path2DSet } from 'modern-path2d'
import type { SVGLoader } from './createSVGLoader'
import { svgToDOM, svgToPath2DSet } from 'modern-path2d'

export interface SVGParser {
  parsed: Map<string, { dom: SVGElement, pathSet: Path2DSet }>
  parse: (svg: string) => { dom: SVGElement, pathSet: Path2DSet }
}

export function createSVGParser(loader: SVGLoader): SVGParser {
  const parsed = new Map<string, { dom: SVGElement, pathSet: Path2DSet }>()

  function parse(svg: string): { dom: SVGElement, pathSet: Path2DSet } {
    let result = parsed.get(svg)
    if (!result) {
      const dom = svgToDOM(
        loader.needsLoad(svg)
          ? loader.loaded.get(svg) ?? svg
          : svg,
      )
      const pathSet = svgToPath2DSet(dom)
      result = { dom, pathSet }
      parsed.set(svg, result)
    }
    return result
  }

  return {
    parsed,
    parse,
  }
}
