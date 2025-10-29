export interface SvgLoader {
  loaded: Map<string, string>
  needsLoad: (source: string) => boolean
  load: (svg: string) => Promise<void>
}

export function createSvgLoader(): SvgLoader {
  const loaded = new Map<string, string>()

  async function load(svg: string): Promise<void> {
    if (!loaded.has(svg)) {
      loaded.set(svg, svg)
      try {
        loaded.set(svg, await fetch(svg).then(rep => rep.text()))
      }
      catch (err) {
        console.warn(err)
        loaded.delete(svg)
      }
    }
  }

  function needsLoad(source: string): boolean {
    return source.startsWith('http://')
      || source.startsWith('https://')
      || source.startsWith('blob://')
  }

  return {
    loaded,
    needsLoad,
    load,
  }
}
