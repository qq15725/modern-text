import type { Path2D } from 'modern-path2d'
import type { Character } from '../content'
import type { HighlightLine, HighlightSize, HighlightThickness, TextPlugin, TextStyle } from '../types'
import { BoundingBox, getPathsBoundingBox, Matrix3, parseSvg, parseSvgToDom } from 'modern-path2d'
import { drawPath } from '../canvas'
import { definePlugin } from '../definePlugin'
import { hexToRgb, isEqualObject, isNone } from '../utils'

function parseCharsPerRepeat(size: HighlightSize, fontSize: number, total: number): number {
  if (size === 'cover') {
    return 0
  }
  else if (typeof size === 'string') {
    if (size.endsWith('%')) {
      const rate = Number(size.substring(0, size.length - 1)) / 100
      return Math.ceil(rate * total / fontSize)
    }
    else if (size.endsWith('rem')) {
      return Number(size.substring(0, size.length - 3))
    }
    else {
      return Math.ceil(Number(size) / fontSize)
    }
  }
  else {
    return Math.ceil(size / fontSize)
  }
}

function parseThickness(thickness: HighlightThickness, fontSize: number, total: number): number {
  if (typeof thickness === 'string') {
    if (thickness.endsWith('%')) {
      return Number(thickness.substring(0, thickness.length - 1)) / 100
    }
    else if (thickness.endsWith('rem')) {
      const value = Number(thickness.substring(0, thickness.length - 3))
      return (value * fontSize) / total
    }
    else {
      return Number(thickness) / total
    }
  }
  else {
    return thickness / total
  }
}

export function highlight(): TextPlugin {
  const paths: Path2D[] = []
  const clipRects: (BoundingBox | undefined)[] = []
  const svgStringToSvgPaths = new Map<string, { dom: SVGElement, paths: Path2D[] }>()

  function getPaths(svg: string): { dom: SVGElement, paths: Path2D[] } {
    let result = svgStringToSvgPaths.get(svg)
    if (!result) {
      const dom = parseSvgToDom(svg)
      const paths = parseSvg(dom)
      result = { dom, paths }
      svgStringToSvgPaths.set(svg, result)
    }
    return result
  }

  return definePlugin({
    name: 'highlight',
    paths,
    update: (text) => {
      paths.length = 0
      const groups: Character[][] = []
      let group: Character[]
      let prevStyle: TextStyle | undefined
      text.forEachCharacter((character) => {
        const { isVertical, computedStyle: style, inlineBox, fontSize } = character
        if (!isNone(style.highlightImage) && character.glyphBox) {
          if (
            style.highlightSize !== '1rem'
            && (
              !prevStyle || (
                prevStyle.highlightImage === style.highlightImage
                && isEqualObject(prevStyle.highlightImageColors, style.highlightImageColors)
                && prevStyle.highlightLine === style.highlightLine
                && prevStyle.highlightSize === style.highlightSize
                && prevStyle.highlightThickness === style.highlightThickness
                && prevStyle.highlightOverflow === style.highlightOverflow
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
        prevStyle = style
      })

      groups
        .filter(characters => characters.length)
        .map((characters) => {
          const char = characters[0]!
          return {
            char,
            groupBox: BoundingBox.from(...characters.map(c => c.glyphBox!)),
          }
        })
        .forEach((group) => {
          const { char, groupBox } = group
          const { computedStyle: style } = char
          const {
            fontSize,
            writingMode,
            highlightThickness,
            highlightSize,
            highlightLine,
            highlightOverflow,
            highlightImage,
            highlightImageColors,
          } = style
          const isVertical = writingMode.includes('vertical')
          const thickness = parseThickness(highlightThickness, fontSize, groupBox.width)
          const charsPerRepeat = parseCharsPerRepeat(highlightSize, fontSize, groupBox.width)
          const overflow = isNone(highlightOverflow)
            ? charsPerRepeat ? 'hidden' : 'visible'
            : highlightOverflow
          const colors = Object.keys(highlightImageColors).reduce((obj, key) => {
            let value = highlightImageColors[key]
            const keyRgb = hexToRgb(key)
            const valueRgb = hexToRgb(value)
            if (keyRgb) {
              key = keyRgb
            }
            if (valueRgb) {
              value = valueRgb
            }
            obj[key] = value
            return obj
          }, {} as Record<string, string>)
          const { paths: svgPaths, dom: svgDom } = getPaths(highlightImage)
          const aBox = getPathsBoundingBox(svgPaths, true)!
          const cBox = new BoundingBox().copy(groupBox)
          cBox.width = charsPerRepeat
            ? (fontSize * charsPerRepeat)
            : isVertical ? groupBox.height : groupBox.width
          cBox.height = isVertical ? groupBox.width : groupBox.height
          const width = isVertical ? cBox.height : cBox.width

          let line: Omit<HighlightLine, 'none'>
          if (isNone(highlightLine)) {
            if (aBox.width / aBox.height > 4) {
              line = 'underline'
              const viewBox = svgDom.getAttribute('viewBox')
              if (viewBox) {
                const aCenter = aBox.y + aBox.height / 2
                const [_x, y, _w, h] = viewBox.split(' ').map(v => Number(v))
                const vCenter = y + h / 2
                const diff = vCenter - aCenter
                if (Math.abs(diff) < aBox.height * 2) {
                  line = 'line-through'
                }
                else if (diff > 0) {
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
              cBox.height = char.underlineThickness * 2
              if (isVertical) {
                cBox.x = char.inlineBox.left + char.inlineBox.width - cBox.height
              }
              else {
                cBox.y = char.inlineBox.top
              }
              break
            case 'line-through':
              cBox.height = char.strikeoutSize * 2
              if (isVertical) {
                cBox.x = char.inlineBox.left + char.inlineBox.width - char.strikeoutPosition - cBox.height
              }
              else {
                cBox.y = char.inlineBox.top + char.strikeoutPosition
              }
              break
            case 'underline':
              cBox.height = char.underlineThickness * 2
              if (isVertical) {
                cBox.x = char.inlineBox.left + char.inlineBox.width - char.underlinePosition - cBox.height
              }
              else {
                cBox.y = char.inlineBox.top + char.underlinePosition
              }
              break
          }

          const transform = new Matrix3()
            .translate(-aBox.x, -aBox.y)
            .scale(cBox.width / aBox.width, cBox.height / aBox.height)
          if (isVertical) {
            transform.rotate(-Math.PI / 2)
          }
          transform.translate(cBox.x, cBox.y)

          const styleScale = fontSize / aBox.width

          for (let i = 0, len = Math.ceil(groupBox.width / width); i < len; i++) {
            const _transform = transform.clone().translate(i * width, 0)
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
              if (path.style.fill && (path.style.fill as string) in colors) {
                path.style.fill = colors[path.style.fill as string]
              }
              if (path.style.stroke && (path.style.stroke as string) in colors) {
                path.style.stroke = colors[path.style.stroke as string]
              }
              paths.push(path)
              clipRects[paths.length - 1] = overflow === 'hidden'
                ? new BoundingBox(
                  groupBox.left,
                  groupBox.top - groupBox.height,
                  groupBox.width,
                  groupBox.height * 3,
                )
                : undefined
            })
          }
        })
    },
    renderOrder: -1,
    render: (ctx, text) => {
      paths.forEach((path, index) => {
        drawPath({
          ctx,
          path,
          clipRect: clipRects[index],
          fontSize: text.computedStyle.fontSize,
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
