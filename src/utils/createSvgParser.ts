import type { Path2DSet } from 'modern-path2d'
import type { SvgLoader } from './createSvgLoader'
import { svgToDom, svgToPath2DSet } from 'modern-path2d'

export interface SvgParser {
  parsed: Map<string, { dom: SVGElement, pathSet: Path2DSet }>
  parse: (svg: string) => { dom: SVGElement, pathSet: Path2DSet }
}

export function createSvgParser(loader: SvgLoader): SvgParser {
  const parsed = new Map<string, { dom: SVGElement, pathSet: Path2DSet }>()

  function parse(svg: string): { dom: SVGElement, pathSet: Path2DSet } {
    let result = parsed.get(svg)
    if (!result) {
      const dom = svgToDom(
        loader.needsLoad(svg)
          ? loader.loaded.get(svg) ?? '<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0" viewBox="0 0 0 0" />'
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
