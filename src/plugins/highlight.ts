import type { Character } from '../content'
import type { HighlightSize, HighlightStrokeWidth, TextPlugin, TextStyle } from '../types'
import { BoundingBox, Matrix3, type Path2D } from 'modern-path2d'
import { getPathsBoundingBox, parseSvg } from 'modern-path2d'
import { drawPath } from '../canvas'
import { definePlugin } from '../definePlugin'
import { isNone } from '../utils'

const defaultReferImage = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI3MiIgaGVpZ2h0PSI3MiIgdmlld0JveD0iMCAwIDcyIDcyIiBmaWxsPSJub25lIj48cGF0aCBmaWxsLXJ1bGU9ImV2ZW5vZGQiIGNsaXAtcnVsZT0iZXZlbm9kZCIgZD0iTTMyLjQwMjkgMjhIMzUuMTU5NFYzMy4xNzcxQzM1Ljk4MjEgMzIuMzExNSAzNi45NzEgMzEuODczNyAzOC4wOTQ4IDMxLjg3MzdDMzkuNjY3NiAzMS44NzM3IDQwLjkxNjYgMzIuNDI5NSA0MS44MzkgMzMuNTQzN0w0MS44NDAzIDMzLjU0NTNDNDIuNjcxNyAzNC41NzA1IDQzLjA5MTUgMzUuODU1OSA0My4wOTE1IDM3LjM4NzdDNDMuMDkxNSAzOC45NzYxIDQyLjY3MjkgNDAuMzAyOCA0MS44MTgzIDQxLjMzMDRMNDEuODE3MSA0MS4zMzE4QzQwLjg3MzEgNDIuNDQ2MSAzOS41ODMyIDQzIDM3Ljk3MjEgNDNDMzYuNzQ3NyA0MyAzNS43NDg4IDQyLjY1OTkgMzQuOTk1OCA0MS45NjkzVjQyLjcyNDdIMzIuNDAyOVYyOFpNMzcuNTQyOCAzNC4wOTI0QzM2Ljg1NDkgMzQuMDkyNCAzNi4zMDE0IDM0LjM1NjEgMzUuODQ4NyAzNC45MDA0TDM1Ljg0NTIgMzQuOTA0NkMzNS4zMzU4IDM1LjQ4NTMgMzUuMDc3NiAzNi4yOTc2IDM1LjA3NzYgMzcuMzQ4NFYzNy41MDU3QzM1LjA3NzYgMzguNDY0IDM1LjI3NzIgMzkuMjQ0MyAzNS42OTQzIDM5LjgyNzlDMzYuMTQ0MSA0MC40NTg3IDM2Ljc3MjYgNDAuNzgxMyAzNy42MjQ1IDQwLjc4MTNDMzguNTg3NCA0MC43ODEzIDM5LjI3MDcgNDAuNDUyNyAzOS43MTUyIDM5LjgxMjdDNDAuMDcyOCAzOS4yNjg0IDQwLjI3MzcgMzguNDY3MyA0MC4yNzM3IDM3LjM4NzdDNDAuMjczNyAzNi4zMTA1IDQwLjA1MzMgMzUuNTMxMyAzOS42NzgzIDM1LjAwNzdDMzkuMjM3MSAzNC40MDcxIDM4LjUzNDIgMzQuMDkyNCAzNy41NDI4IDM0LjA5MjRaIiBmaWxsPSIjMjIyNTI5Ii8+PHBhdGggZD0iTTQ5Ljg2MTQgMzEuODczN0M0OC4xNTM1IDMxLjg3MzcgNDYuODAxNiAzMi40MjM5IDQ1LjgzNDggMzMuNTM5MkM0NC45MzcgMzQuNTQ3MiA0NC40OTY2IDM1Ljg1NiA0NC40OTY2IDM3LjQyN0M0NC40OTY2IDM5LjAzNjggNDQuOTM2NyA0MC4zNjU5IDQ1Ljg1NTkgNDEuMzk0M0M0Ni44MDMxIDQyLjQ3MDYgNDguMTM0OCA0MyA0OS44MjA1IDQzQzUxLjIyNiA0MyA1Mi4zODI2IDQyLjY1NjMgNTMuMjQ3OSA0MS45Njk3QzU0LjEzNTkgNDEuMjYxNCA1NC43MDYxIDQwLjE4ODcgNTQuOTU3MyAzOC43NzkxTDU1IDM4LjUzOTdINTIuMjQ4NEw1Mi4yMjU5IDM4LjcyMDFDNTIuMTM3OSAzOS40MjUxIDUxLjg5MjUgMzkuOTI3OCA1MS41MTA5IDQwLjI1NThDNTEuMTI5NSA0MC41ODM1IDUwLjU4MzEgNDAuNzYxNiA0OS44NDA5IDQwLjc2MTZDNDkuMDAwMSA0MC43NjE2IDQ4LjM5NDkgNDAuNDcxNSA0Ny45OTA3IDM5LjkyMzdMNDcuOTg3NCAzOS45MTk0QzQ3LjUzNTYgMzkuMzQwMSA0Ny4zMTQ0IDM4LjUwNjIgNDcuMzE0NCAzNy40MDc0QzQ3LjMxNDQgMzYuMzMyMiA0Ny41NTQ0IDM1LjUxNzcgNDguMDA1OCAzNC45NTY4TDQ4LjAwNzggMzQuOTU0M0M0OC40NTM3IDM0LjM4MjUgNDkuMDYxOCAzNC4xMTIxIDQ5Ljg2MTQgMzQuMTEyMUM1MC41MjMgMzQuMTEyMSA1MS4wNDUxIDM0LjI2MTUgNTEuNDI3MiAzNC41NDA3QzUxLjc4ODQgMzQuODE5NCA1Mi4wNTMgMzUuMjQ0NyA1Mi4xODgxIDM1Ljg1NzFMNTIuMjIzOSAzNi4wMTk0SDU0Ljk1NDhMNTQuOTE3IDM1Ljc4MzVDNTQuNzA2MyAzNC40NjYgNTQuMTUzNiAzMy40NzAxIDUzLjI2MzQgMzIuODAxOUw1My4yNjAyIDMyLjc5OTVDNTIuMzk1MSAzMi4xNzU1IDUxLjI2MjEgMzEuODczNyA0OS44NjE0IDMxLjg3MzdaIiBmaWxsPSIjMjIyNTI5Ii8+PHBhdGggZmlsbC1ydWxlPSJldmVub2RkIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiIGQ9Ik0yNS43NTYxIDI4LjI3NTNIMjIuNzQ0TDE3IDQyLjcyNDdIMjAuMDE0MUwyMS4zNDI5IDM5LjIwNDlIMjcuMTU3MkwyOC40ODYgNDIuNzI0N0gzMS41MDAxTDI1Ljc1NjEgMjguMjc1M1pNMjIuMjEyNSAzNi45MDc2TDI0LjI1OTYgMzEuNDUzOUwyNi4yODg1IDM2LjkwNzZIMjIuMjEyNVoiIGZpbGw9IiMyMjI1MjkiLz48L3N2Zz4='

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

function parseStrokeWidthScale(strokeWidth: HighlightStrokeWidth, fontSize: number, total: number): number {
  if (typeof strokeWidth === 'string') {
    if (strokeWidth.endsWith('%')) {
      return Number(strokeWidth.substring(0, strokeWidth.length - 1)) / 100
    }
    else if (strokeWidth.endsWith('rem')) {
      const value = Number(strokeWidth.substring(0, strokeWidth.length - 3))
      return (value * fontSize) / total
    }
    else {
      return Number(strokeWidth) / total
    }
  }
  else {
    return strokeWidth / total
  }
}

function getTransformMatrix(a: BoundingBox, b: BoundingBox, c: BoundingBox, isVertical: boolean): Matrix3 {
  let scale
  if (!isVertical) {
    scale = {
      x: c.width / b.width,
      y: c.height / b.height,
    }
  }
  else {
    scale = {
      x: c.width / b.height,
      y: c.height / b.width,
    }
  }
  const offset = c.center
    .add(
      a.center
        .sub(b.center)
        .scale(scale.x, scale.y),
    )
    .sub({
      x: a.width / 2 * scale.x,
      y: a.height / 2 * scale.y,
    })
  const m = new Matrix3()
  m.translate(-a.left, -a.top)
  if (isVertical) {
    m.translate(-a.width / 2, -a.height / 2)
    m.rotate(Math.PI / 2)
    m.translate(a.width / 2, a.height / 2)
  }
  m.scale(scale.x, scale.y)
  m.translate(offset.x, offset.y)

  return m
}

export function highlight(): TextPlugin {
  const paths: Path2D[] = []
  const clipRects: (BoundingBox | undefined)[] = []
  const svgStringToSvgPaths = new Map<string, Path2D[]>()

  function getPaths(svg: string): Path2D[] {
    let paths = svgStringToSvgPaths.get(svg)
    if (!paths) {
      paths = parseSvg(svg)
      svgStringToSvgPaths.set(svg, paths)
    }
    return paths
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
            && prevStyle?.highlightImage === style.highlightImage
            && prevStyle?.highlightSize === style.highlightSize
            && prevStyle?.highlightStrokeWidth === style.highlightStrokeWidth
            && prevStyle?.highlightOverflow === style.highlightOverflow
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
            style: char.computedStyle!,
            unitHeight: char.typoAscender + char.typoDescender,
            box: BoundingBox.from(...characters.map(c => c.glyphBox!)),
          }
        })
        .forEach((group) => {
          const { style, box: groupBox, unitHeight } = group
          const { fontSize, writingMode } = style
          const isVertical = writingMode.includes('vertical')
          const strokeWidthScale = parseStrokeWidthScale(style.highlightStrokeWidth, fontSize, groupBox.width)
          const charsPerRepeat = parseCharsPerRepeat(style.highlightSize, fontSize, groupBox.width)
          const highlightOverflow = isNone(style.highlightOverflow)
            ? charsPerRepeat ? 'hidden' : 'visible'
            : style.highlightOverflow
          const refPaths = getPaths(isNone(style.highlightReferImage) ? defaultReferImage : style.highlightReferImage)
          const svgPaths = getPaths(style.highlightImage)
          const box = getPathsBoundingBox(svgPaths, true)!
          const refBox = getPathsBoundingBox(refPaths, false)!
          const unitWidth = charsPerRepeat ? (fontSize * charsPerRepeat) : isVertical ? groupBox.height : groupBox.width
          const transform = getTransformMatrix(
            box,
            refBox,
            new BoundingBox(groupBox.left, groupBox.top, isVertical ? unitHeight : unitWidth, isVertical ? unitWidth : unitHeight),
            isVertical,
          )
          const styleScale = fontSize / box.width * 2
          const total = Math.ceil(groupBox.width / unitWidth)
          for (let i = 0; i < total; i++) {
            const _transform = transform.clone().translate(i * unitWidth, 0)
            svgPaths.forEach((original) => {
              const path = original.clone().matrix(_transform)
              if (path.style.strokeWidth) {
                path.style.strokeWidth *= styleScale * strokeWidthScale
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

              paths.push(path)
              clipRects[paths.length - 1] = highlightOverflow === 'hidden'
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
      })
    },
  })
}
