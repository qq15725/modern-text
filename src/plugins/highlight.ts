import type { Path2D } from 'modern-path2d'
import type { Character } from '../content'
import type { HighlightLine, TextPlugin, TextStyle } from '../types'
import { BoundingBox, getPathsBoundingBox, Matrix3, parseSvg, parseSvgToDom } from 'modern-path2d'
import { drawPath } from '../canvas'
import { definePlugin } from '../definePlugin'
import { isEqualValue, isNone, needsFetch, parseColormap, parseValueNumber } from '../utils'

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
      const dom = parseSvgToDom(
        needsFetch(svg)
          ? loaded.get(svg) ?? svg
          : svg,
      )
      const paths = parseSvg(dom)
      result = { dom, paths }
      parsed.set(svg, result)
    }
    return result
  }

  return definePlugin({
    name: 'highlight',
    paths,
    load: async (text) => {
      const promises: Promise<void>[] = []
      text.forEachCharacter((character) => {
        const { computedStyle: style } = character
        const { highlightImage, highlightReferImage } = style
        if (needsFetch(highlightImage)) {
          promises.push(loadSvg(highlightImage))
        }
        if (needsFetch(highlightReferImage)) {
          promises.push(loadSvg(highlightReferImage))
        }
      })
      await Promise.all(promises)
    },
    update: (text) => {
      clipRects.length = 0
      paths.length = 0
      let groups: Character[][] = []
      let group: Character[]
      let prevStyle: TextStyle | undefined
      text.forEachCharacter((character) => {
        const {
          computedStyle: style,
        } = character

        const {
          highlightImage,
        } = style

        if (!isNone(highlightImage)) {
          const {
            inlineBox,
            isVertical,
          } = character

          const {
            fontSize,
            highlightColormap,
            highlightLine,
            highlightSize,
            highlightThickness,
          } = style

          if (
            (
              !prevStyle || (
                isEqualValue(prevStyle.highlightImage, highlightImage)
                && isEqualValue(prevStyle.highlightColormap, highlightColormap)
                && isEqualValue(prevStyle.highlightLine, highlightLine)
                && isEqualValue(prevStyle.highlightSize, highlightSize)
                && isEqualValue(prevStyle.highlightThickness, highlightThickness)
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
        prevStyle = style
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
          highlightImage,
          highlightReferImage,
          highlightColormap,
          highlightLine,
          highlightSize,
          highlightThickness,
        } = style

        const isVertical = writingMode.includes('vertical')
        const thickness = parseValueNumber(highlightThickness, { fontSize, total: groupBox.width }) / groupBox.width
        const colormap = parseColormap(highlightColormap)
        const { paths: svgPaths, dom: svgDom } = getPaths(highlightImage)
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
        if (highlightSize !== 'cover') {
          userWidth = parseValueNumber(highlightSize, { fontSize, total: groupBox.width })
          cBox.width = userWidth
        }
        if (!isNone(highlightReferImage) && isNone(highlightLine)) {
          const bBox = getPathsBoundingBox(getPaths(highlightReferImage).paths, true)!
          aBox.copy(bBox)
        }
        else {
          let line: Omit<HighlightLine, 'none'>
          if (isNone(highlightLine)) {
            if (aBox.width / aBox.height > 4) {
              line = 'underline'
              const viewBox = svgDom.getAttribute('viewBox')
              if (viewBox) {
                const [_x, y, _w, h] = viewBox.split(' ').map(v => Number(v))
                const viewCenter = y + h / 2
                if (aBox.y < viewCenter && aBox.y + aBox.height > viewCenter) {
                  line = 'line-through'
                }
                else if (aBox.y + aBox.height < viewCenter) {
                  line = 'overline'
                }
                else {
                  line = 'underline'
                }
              }
            }
            else {
              line = 'outline'
            }
          }
          else {
            line = highlightLine
          }

          switch (line) {
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
              path.style.strokeWidth *= styleScale * thickness
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
            if (path.style.fill && (path.style.fill as string) in colormap) {
              path.style.fill = colormap[path.style.fill as string]
            }
            if (path.style.stroke && (path.style.stroke as string) in colormap) {
              path.style.stroke = colormap[path.style.stroke as string]
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
