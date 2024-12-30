import type { HighlightLine, IDOCHighlightDeclaration, IDOCStyleDeclaration } from 'modern-idoc'
import type { Path2D } from 'modern-path2d'
import type { Character } from '../content'
import type { TextPlugin } from '../types'
import { BoundingBox, getPathsBoundingBox, Matrix3, parseSVG, parseSVGToDOM } from 'modern-path2d'
import { drawPath } from '../canvas'
import { definePlugin } from '../definePlugin'

import { isEqualValue, isNone, needsFetch, parseColormap, parseValueNumber } from '../utils'

export function getHighlightStyle(style: IDOCStyleDeclaration): IDOCHighlightDeclaration {
  const {
    highlight,
    highlightImage,
    highlightReferImage,
    highlightColormap,
    highlightLine,
    highlightSize,
    highlightThickness,
  } = style

  return {
    image: highlight?.image ?? highlightImage ?? 'none',
    referImage: highlight?.referImage ?? highlightReferImage ?? 'none',
    colormap: highlight?.colormap ?? highlightColormap ?? 'none',
    line: highlight?.line ?? highlightLine ?? 'none',
    size: highlight?.size ?? highlightSize ?? 'cover',
    thickness: highlight?.thickness ?? highlightThickness ?? '100%',
  }
}

export function highlight(): TextPlugin {
  const paths: Path2D[] = []
  const clipRects: (BoundingBox | undefined)[] = []
  const loaded = new Map<string, string>()
  const parsed = new Map<string, { dom: SVGElement, paths: Path2D[] }>()

  async function loadSvg(svg: string): Promise<void> {
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

  function getPaths(svg: string): { dom: SVGElement, paths: Path2D[] } {
    let result = parsed.get(svg)
    if (!result) {
      const dom = parseSVGToDOM(
        needsFetch(svg)
          ? loaded.get(svg) ?? svg
          : svg,
      )
      const paths = parseSVG(dom)
      result = { dom, paths }
      parsed.set(svg, result)
    }
    return result
  }

  return definePlugin({
    name: 'highlight',
    paths,
    load: async (text) => {
      const set = new Set<string>()
      text.forEachCharacter((character) => {
        const { computedStyle: style } = character
        const { image, referImage } = getHighlightStyle(style)
        if (needsFetch(image)) {
          set.add(image)
        }
        if (needsFetch(referImage)) {
          set.add(referImage)
        }
      })
      await Promise.all(Array.from(set).map(src => loadSvg(src)))
    },
    update: (text) => {
      clipRects.length = 0
      paths.length = 0
      let groups: Character[][] = []
      let group: Character[]
      let prevHighlight: IDOCHighlightDeclaration | undefined
      text.forEachCharacter((character) => {
        const {
          computedStyle: style,
        } = character

        const highlight = getHighlightStyle(style)

        const {
          image,
          colormap,
          line,
          size,
          thickness,
        } = highlight

        if (!isNone(image)) {
          const {
            inlineBox,
            isVertical,
          } = character

          const {
            fontSize,
          } = style

          if (
            (
              !prevHighlight || (
                isEqualValue(prevHighlight.image, image)
                && isEqualValue(prevHighlight.colormap, colormap)
                && isEqualValue(prevHighlight.line, line)
                && isEqualValue(prevHighlight.size, size)
                && isEqualValue(prevHighlight.thickness, thickness)
              )
            )
            && group?.length
            && (
              isVertical
                ? group[0].inlineBox.left === inlineBox.left
                : group[0].inlineBox.top === inlineBox.top
            )
            && group[0].fontSize === fontSize
          ) {
            group.push(character)
          }
          else {
            group = []
            group.push(character)
            groups.push(group)
          }
        }
        else {
          if (group?.length) {
            group = []
            groups.push(group)
          }
        }
        prevHighlight = highlight
      })

      groups = groups.filter(characters => characters.length)

      for (let i = 0; i < groups.length; i++) {
        const characters = groups[i]
        const char = characters[0]!
        const groupBox = BoundingBox.from(
          ...(
            characters
              .filter(c => c.glyphBox)
              .map(c => c.glyphBox) as BoundingBox[]
          ),
        )

        const {
          computedStyle: style,
        } = char

        const {
          fontSize,
          writingMode,
        } = style

        const {
          image,
          referImage,
          colormap,
          line,
          size,
          thickness,
        } = getHighlightStyle(style)

        const isVertical = writingMode.includes('vertical')
        const _thickness = parseValueNumber(thickness, { fontSize, total: groupBox.width }) / groupBox.width
        const _colormap = parseColormap(colormap)
        const { paths: svgPaths, dom: svgDom } = getPaths(image)
        const aBox = getPathsBoundingBox(svgPaths, true)!
        const styleScale = fontSize / aBox.width * 2
        const cBox = new BoundingBox().copy(groupBox)
        if (isVertical) {
          cBox.width = groupBox.height
          cBox.height = groupBox.width
          cBox.left = groupBox.left + groupBox.width
        }
        const rawWidth = Math.floor(cBox.width)
        let userWidth = rawWidth
        if (size !== 'cover') {
          userWidth = parseValueNumber(size, { fontSize, total: groupBox.width }) || rawWidth
          cBox.width = userWidth
        }
        if (!isNone(referImage) && isNone(line)) {
          const bBox = getPathsBoundingBox(getPaths(referImage).paths, true)!
          aBox.copy(bBox)
        }
        else {
          let _line: Omit<HighlightLine, 'none'>
          if (isNone(line)) {
            if (aBox.width / aBox.height > 4) {
              _line = 'underline'
              const viewBox = svgDom.getAttribute('viewBox')
              if (viewBox) {
                const [_x, y, _w, h] = viewBox.split(' ').map(v => Number(v))
                const viewCenter = y + h / 2
                if (aBox.y < viewCenter && aBox.y + aBox.height > viewCenter) {
                  _line = 'line-through'
                }
                else if (aBox.y + aBox.height < viewCenter) {
                  _line = 'overline'
                }
                else {
                  _line = 'underline'
                }
              }
            }
            else {
              _line = 'outline'
            }
          }
          else {
            _line = line
          }

          switch (_line) {
            case 'outline': {
              const paddingX = cBox.width * 0.2
              const paddingY = cBox.height * 0.2
              cBox.width += paddingX
              cBox.height += paddingY
              if (isVertical) {
                cBox.x -= paddingY / 2
                cBox.y -= paddingX / 2
                cBox.x += cBox.height
              }
              else {
                cBox.x -= paddingX / 2
                cBox.y -= paddingY / 2
              }
              break
            }
            case 'overline':
              cBox.height = aBox.height * styleScale
              if (isVertical) {
                cBox.x = char.inlineBox.left + char.inlineBox.width
              }
              else {
                cBox.y = char.inlineBox.top
              }
              break
            case 'line-through':
              cBox.height = aBox.height * styleScale
              if (isVertical) {
                cBox.x = char.inlineBox.left + char.inlineBox.width - char.strikeoutPosition + cBox.height / 2
              }
              else {
                cBox.y = char.inlineBox.top + char.strikeoutPosition - cBox.height / 2
              }
              break
            case 'underline':
              cBox.height = aBox.height * styleScale
              if (isVertical) {
                cBox.x = char.inlineBox.left + char.inlineBox.width - char.underlinePosition
              }
              else {
                cBox.y = char.inlineBox.top + char.underlinePosition
              }
              break
          }
        }

        const transform = new Matrix3()
          .translate(-aBox.x, -aBox.y)
          .scale(cBox.width / aBox.width, cBox.height / aBox.height)
        if (isVertical) {
          transform.rotate(-Math.PI / 2)
        }
        transform.translate(cBox.x, cBox.y)

        for (let i = 0; i < Math.ceil(rawWidth / userWidth); i++) {
          const _transform = transform.clone()
          if (isVertical) {
            _transform.translate(0, i * cBox.width)
          }
          else {
            _transform.translate(i * cBox.width, 0)
          }
          svgPaths.forEach((originalPath) => {
            const path = originalPath.clone().matrix(_transform)
            if (path.style.strokeWidth) {
              path.style.strokeWidth *= styleScale * _thickness
            }
            if (path.style.strokeMiterlimit) {
              path.style.strokeMiterlimit *= styleScale
            }
            if (path.style.strokeDashoffset) {
              path.style.strokeDashoffset *= styleScale
            }
            if (path.style.strokeDasharray) {
              path.style.strokeDasharray = path.style.strokeDasharray.map(v => v * styleScale)
            }
            if (path.style.fill && (path.style.fill as string) in _colormap) {
              path.style.fill = _colormap[path.style.fill as string]
            }
            if (path.style.stroke && (path.style.stroke as string) in _colormap) {
              path.style.stroke = _colormap[path.style.stroke as string]
            }
            paths.push(path)
            if (rawWidth !== userWidth) {
              if (isVertical) {
                clipRects[paths.length - 1] = new BoundingBox(
                  groupBox.left - groupBox.width * 2,
                  groupBox.top,
                  groupBox.width * 4,
                  groupBox.height,
                )
              }
              else {
                clipRects[paths.length - 1] = new BoundingBox(
                  groupBox.left,
                  groupBox.top - groupBox.height * 2,
                  groupBox.width,
                  groupBox.height * 4,
                )
              }
            }
          })
        }
      }
    },
    renderOrder: -1,
    render: (ctx, text) => {
      paths.forEach((path, index) => {
        drawPath({
          ctx,
          path,
          fontSize: text.computedStyle.fontSize,
          clipRect: clipRects[index],
        })

        if (text.debug) {
          const box = getPathsBoundingBox([path])
          if (box) {
            ctx.strokeRect(box.x, box.y, box.width, box.height)
          }
        }
      })
    },
  })
}
