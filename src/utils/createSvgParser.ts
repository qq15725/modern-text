import type { SvgLoader } from './createSvgLoader'
import { Path2DSet, svgToDom, svgToPath2DSet } from 'modern-path2d'

export interface SvgParser {
  parsed: Map<string, { dom: SVGElement, pathSet: Path2DSet }>
  parse: (svg: string) => { dom: SVGElement, pathSet: Path2DSet }
}

export function createSvgParser(loader: SvgLoader): SvgParser {
  const parsed = new Map<string, { dom: SVGElement, pathSet: Path2DSet }>()

  function parse(svg: string): { dom: SVGElement, pathSet: Path2DSet } {
    let result = parsed.get(svg)
    if (!result) {
      const svgString = loader.needsLoad(svg)
        ? loader.loaded.get(svg)
        : svg
      if (svgString) {
        const dom = svgToDom(svgString)
        const pathSet = svgToPath2DSet(dom)
        result = { dom, pathSet }
        parsed.set(svg, result)
      }
      else {
        const dom = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
        dom.setAttribute('width', '0')
        dom.setAttribute('height', '0')
        dom.setAttribute('viewBox', '0 0 0 0')
        result = { dom, pathSet: new Path2DSet() }
      }
    }
    return result
  }

  return {
    parsed,
    parse,
  }
}
