import type { Character } from '../content'
import type { TextPlugin, TextStyle } from '../types'
import { BoundingBox, Path2D } from 'modern-path2d'
import { drawPath } from '../canvas'
import { definePlugin } from '../definePlugin'
import { isNone } from '../utils'
import { getTransform2D } from './render'

export function textDecoration(): TextPlugin {
  const paths: Path2D[] = []
  return definePlugin({
    name: 'textDecoration',
    paths,
    update: (text) => {
      paths.length = 0
      const groups: Character[][] = []
      let group: Character[]
      let prevStyle: TextStyle | undefined
      text.forEachCharacter((character) => {
        const { computedStyle: style, isVertical, inlineBox, underlinePosition, underlineThickness, strikeoutPosition, strikeoutSize } = character
        if (!isNone(style.textDecoration)) {
          let flag = false
          if (
            prevStyle?.textDecoration === style.textDecoration
            && prevStyle?.writingMode === style.writingMode
            && (
              isVertical
                ? group[0].inlineBox.left === inlineBox.left
                : group[0].inlineBox.top === inlineBox.top
            )
          ) {
            switch (style.textDecoration) {
              case 'underline':
                if (
                  group[0].underlinePosition === underlinePosition
                  && group[0].underlineThickness === underlineThickness
                ) {
                  flag = true
                }
                break
              case 'line-through':
                if (
                  group[0].strikeoutPosition === strikeoutPosition
                  && group[0].strikeoutSize === strikeoutSize
                ) {
                  flag = true
                }
                break
            }
          }
          if (flag) {
            group.push(character)
          }
          else {
            group = []
            group.push(character)
            groups.push(group)
          }
          prevStyle = style
        }
        else {
          prevStyle = undefined
        }
      })

      groups.forEach((group) => {
        const { computedStyle: style, isVertical, underlinePosition, underlineThickness, strikeoutPosition, strikeoutSize } = group[0]
        const { textDecoration } = style
        const { left, top, width, height } = BoundingBox.from(...group.map(c => c.inlineBox))

        let strokePosition = isVertical ? left : top
        let strokeWidth = 0
        switch (textDecoration) {
          case 'underline':
            strokePosition += underlinePosition
            strokeWidth = underlineThickness * 2
            break
          case 'line-through':
            strokePosition += strikeoutPosition
            strokeWidth = strikeoutSize * 2
            break
        }

        strokePosition -= strokeWidth

        if (isVertical) {
          paths.push(new Path2D([
            { type: 'M', x: strokePosition, y: top },
            { type: 'L', x: strokePosition, y: top + height },
            { type: 'L', x: strokePosition + strokeWidth, y: top + height },
            { type: 'L', x: strokePosition + strokeWidth, y: top },
            { type: 'Z' },
          ]))
        }
        else {
          paths.push(new Path2D([
            { type: 'M', x: left, y: strokePosition },
            { type: 'L', x: left + width, y: strokePosition },
            { type: 'L', x: left + width, y: strokePosition + strokeWidth },
            { type: 'L', x: left, y: strokePosition + strokeWidth },
            { type: 'Z' },
          ]))
        }
      })
    },
    render: (ctx, text) => {
      const { effects, fontSize } = text
      if (effects) {
        effects.forEach((style) => {
          ctx.save()
          const [a, c, e, b, d, f] = getTransform2D(text, style).transpose().elements
          ctx.transform(a, b, c, d, e, f)
          paths.forEach((path) => {
            drawPath({
              ctx,
              path,
              fontSize,
              ...style,
            })
          })
          ctx.restore()
        })
      }
      else {
        paths.forEach((path) => {
          drawPath({
            ctx,
            path,
            fontSize,
          })
        })
      }
    },
  })
}
