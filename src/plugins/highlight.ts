import type { Character } from '../content'
import type { Plugin } from '../Plugin'
import type { FragmentHighlight } from '../types'
import { BoundingBox, Matrix3, parseSvgToDom, type Path2D, Vector2 } from 'modern-path2d'
import { parseSvg } from 'modern-path2d'
import { drawPath } from '../canvas'
import { plugin } from '../Plugin'
import { getPathsBoundingBox } from '../utils'

export interface HighlightOptions {
  referImage?: string
}

const defaultOptions: Required<HighlightOptions> = {
  referImage: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI3MiIgaGVpZ2h0PSI3MiIgdmlld0JveD0iMCAwIDcyIDcyIiBmaWxsPSJub25lIj48cGF0aCBmaWxsLXJ1bGU9ImV2ZW5vZGQiIGNsaXAtcnVsZT0iZXZlbm9kZCIgZD0iTTMyLjQwMjkgMjhIMzUuMTU5NFYzMy4xNzcxQzM1Ljk4MjEgMzIuMzExNSAzNi45NzEgMzEuODczNyAzOC4wOTQ4IDMxLjg3MzdDMzkuNjY3NiAzMS44NzM3IDQwLjkxNjYgMzIuNDI5NSA0MS44MzkgMzMuNTQzN0w0MS44NDAzIDMzLjU0NTNDNDIuNjcxNyAzNC41NzA1IDQzLjA5MTUgMzUuODU1OSA0My4wOTE1IDM3LjM4NzdDNDMuMDkxNSAzOC45NzYxIDQyLjY3MjkgNDAuMzAyOCA0MS44MTgzIDQxLjMzMDRMNDEuODE3MSA0MS4zMzE4QzQwLjg3MzEgNDIuNDQ2MSAzOS41ODMyIDQzIDM3Ljk3MjEgNDNDMzYuNzQ3NyA0MyAzNS43NDg4IDQyLjY1OTkgMzQuOTk1OCA0MS45NjkzVjQyLjcyNDdIMzIuNDAyOVYyOFpNMzcuNTQyOCAzNC4wOTI0QzM2Ljg1NDkgMzQuMDkyNCAzNi4zMDE0IDM0LjM1NjEgMzUuODQ4NyAzNC45MDA0TDM1Ljg0NTIgMzQuOTA0NkMzNS4zMzU4IDM1LjQ4NTMgMzUuMDc3NiAzNi4yOTc2IDM1LjA3NzYgMzcuMzQ4NFYzNy41MDU3QzM1LjA3NzYgMzguNDY0IDM1LjI3NzIgMzkuMjQ0MyAzNS42OTQzIDM5LjgyNzlDMzYuMTQ0MSA0MC40NTg3IDM2Ljc3MjYgNDAuNzgxMyAzNy42MjQ1IDQwLjc4MTNDMzguNTg3NCA0MC43ODEzIDM5LjI3MDcgNDAuNDUyNyAzOS43MTUyIDM5LjgxMjdDNDAuMDcyOCAzOS4yNjg0IDQwLjI3MzcgMzguNDY3MyA0MC4yNzM3IDM3LjM4NzdDNDAuMjczNyAzNi4zMTA1IDQwLjA1MzMgMzUuNTMxMyAzOS42NzgzIDM1LjAwNzdDMzkuMjM3MSAzNC40MDcxIDM4LjUzNDIgMzQuMDkyNCAzNy41NDI4IDM0LjA5MjRaIiBmaWxsPSIjMjIyNTI5Ii8+PHBhdGggZD0iTTQ5Ljg2MTQgMzEuODczN0M0OC4xNTM1IDMxLjg3MzcgNDYuODAxNiAzMi40MjM5IDQ1LjgzNDggMzMuNTM5MkM0NC45MzcgMzQuNTQ3MiA0NC40OTY2IDM1Ljg1NiA0NC40OTY2IDM3LjQyN0M0NC40OTY2IDM5LjAzNjggNDQuOTM2NyA0MC4zNjU5IDQ1Ljg1NTkgNDEuMzk0M0M0Ni44MDMxIDQyLjQ3MDYgNDguMTM0OCA0MyA0OS44MjA1IDQzQzUxLjIyNiA0MyA1Mi4zODI2IDQyLjY1NjMgNTMuMjQ3OSA0MS45Njk3QzU0LjEzNTkgNDEuMjYxNCA1NC43MDYxIDQwLjE4ODcgNTQuOTU3MyAzOC43NzkxTDU1IDM4LjUzOTdINTIuMjQ4NEw1Mi4yMjU5IDM4LjcyMDFDNTIuMTM3OSAzOS40MjUxIDUxLjg5MjUgMzkuOTI3OCA1MS41MTA5IDQwLjI1NThDNTEuMTI5NSA0MC41ODM1IDUwLjU4MzEgNDAuNzYxNiA0OS44NDA5IDQwLjc2MTZDNDkuMDAwMSA0MC43NjE2IDQ4LjM5NDkgNDAuNDcxNSA0Ny45OTA3IDM5LjkyMzdMNDcuOTg3NCAzOS45MTk0QzQ3LjUzNTYgMzkuMzQwMSA0Ny4zMTQ0IDM4LjUwNjIgNDcuMzE0NCAzNy40MDc0QzQ3LjMxNDQgMzYuMzMyMiA0Ny41NTQ0IDM1LjUxNzcgNDguMDA1OCAzNC45NTY4TDQ4LjAwNzggMzQuOTU0M0M0OC40NTM3IDM0LjM4MjUgNDkuMDYxOCAzNC4xMTIxIDQ5Ljg2MTQgMzQuMTEyMUM1MC41MjMgMzQuMTEyMSA1MS4wNDUxIDM0LjI2MTUgNTEuNDI3MiAzNC41NDA3QzUxLjc4ODQgMzQuODE5NCA1Mi4wNTMgMzUuMjQ0NyA1Mi4xODgxIDM1Ljg1NzFMNTIuMjIzOSAzNi4wMTk0SDU0Ljk1NDhMNTQuOTE3IDM1Ljc4MzVDNTQuNzA2MyAzNC40NjYgNTQuMTUzNiAzMy40NzAxIDUzLjI2MzQgMzIuODAxOUw1My4yNjAyIDMyLjc5OTVDNTIuMzk1MSAzMi4xNzU1IDUxLjI2MjEgMzEuODczNyA0OS44NjE0IDMxLjg3MzdaIiBmaWxsPSIjMjIyNTI5Ii8+PHBhdGggZmlsbC1ydWxlPSJldmVub2RkIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiIGQ9Ik0yNS43NTYxIDI4LjI3NTNIMjIuNzQ0TDE3IDQyLjcyNDdIMjAuMDE0MUwyMS4zNDI5IDM5LjIwNDlIMjcuMTU3MkwyOC40ODYgNDIuNzI0N0gzMS41MDAxTDI1Ljc1NjEgMjguMjc1M1pNMjIuMjEyNSAzNi45MDc2TDI0LjI1OTYgMzEuNDUzOUwyNi4yODg1IDM2LjkwNzZIMjIuMjEyNVoiIGZpbGw9IiMyMjI1MjkiLz48L3N2Zz4=',
}

export function highlight(options: HighlightOptions = {}): Plugin {
  const config = { ...defaultOptions, ...options }
  const referPaths = parseSvg(config.referImage)
  const paths: Path2D[] = []
  const clipRects: (BoundingBox | undefined)[] = []
  return plugin({
    name: 'highlight',
    paths,
    update: (text) => {
      paths.length = 0
      const { characters } = text
      let group: Character[]
      const groups: Character[][] = []
      let prevHighlight: FragmentHighlight | undefined
      characters.forEach((character) => {
        const highlight = character.parent.highlight
        if (highlight?.image) {
          if (
            highlight.charsPerRepeat !== 1
            && prevHighlight?.image === highlight.image
            && prevHighlight?.strokeWidth === highlight.strokeWidth
            && prevHighlight?.charsPerRepeat === highlight.charsPerRepeat
            && prevHighlight?.overflowHidden === highlight.overflowHidden
            && group.length
            && group[0].boundingBox.top === character.boundingBox.top
            && group[0].fontSize === character.fontSize
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

      groups
        .filter(characters => characters.length)
        .map((characters) => {
          return {
            highlight: characters[0]!.parent.highlight!,
            box: BoundingBox.from(...characters.map(c => c.glyphBox)),
            baseline: Math.max(...characters.map(c => c.baseline)),
            fontSize: characters[0].fontSize,
          }
        })
        .forEach((group) => {
          const { highlight, box: groupBox, fontSize } = group
          const {
            strokeWidth = 1,
            charsPerRepeat = 0,
            overflowHidden = Boolean(charsPerRepeat),
          } = highlight

          const svg = parseSvgToDom(highlight.image)
          const svgPaths = parseSvg(svg)
          const min = Vector2.MAX
          const max = Vector2.MIN
          svgPaths.forEach(path => path.getMinMax(min, max))
          const box = new BoundingBox(min.x, min.y, max.x - min.x, max.y - min.y)

          const referBoundingBox = getPathsBoundingBox(referPaths)!
          const scale = {
            x: charsPerRepeat
              ? ((fontSize * charsPerRepeat) * (box.width / referBoundingBox.width)) / box.width
              : (groupBox.width * (box.width / referBoundingBox.width)) / box.width,
            y: (groupBox.height * (box.height / referBoundingBox.height)) / box.height,
          }
          const styleScale = fontSize / box.width * 2
          const unitWidth = box.width * scale.x
          const total = Math.ceil(groupBox.width / unitWidth)
          const offset = {
            x: (box.left - referBoundingBox.left) * scale.x,
            y: (box.top - referBoundingBox.top) * scale.y,
          }
          const transform = new Matrix3()
            .translate(-box.left, -box.top)
            .scale(scale.x, scale.y)
            .translate(groupBox.left, groupBox.top)
            .translate(offset.x, offset.y)
          for (let i = 0; i < total; i++) {
            const _transform = transform.clone().translate(i * unitWidth, 0)
            svgPaths.forEach((original) => {
              const path = original.clone().matrix(_transform)
              if (path.style.strokeWidth) {
                path.style.strokeWidth *= styleScale * strokeWidth
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
              clipRects[paths.length - 1] = overflowHidden
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