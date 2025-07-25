import type { NormalizedStyle } from 'modern-idoc'
import type { Character } from '../content'
import type { TextPlugin } from '../types'
import { isNone } from 'modern-idoc'
import { BoundingBox, Path2D, Path2DSet } from 'modern-path2d'
import { drawPath } from '../canvas'
import { definePlugin } from '../definePlugin'
import { getTransform2D } from './render'

export function textDecorationPlugin(): TextPlugin {
  const pathSet = new Path2DSet()
  return definePlugin({
    name: 'textDecoration',
    pathSet,
    update: (text) => {
      pathSet.paths.length = 0

      const groups: Character[][] = []
      let group: Character[]
      let prevStyle: NormalizedStyle | undefined
      text.forEachCharacter((character) => {
        const {
          computedStyle: style,
          isVertical,
          inlineBox,
          underlinePosition,
          underlineThickness,
          strikeoutPosition,
          strikeoutSize,
        } = character

        const { color, textDecoration, writingMode } = style

        if (!isNone(textDecoration)) {
          let flag = false
          if (
            prevStyle?.textDecoration === textDecoration
            && prevStyle?.writingMode === writingMode
            && prevStyle?.color === color
            && (
              isVertical
                ? group[0].inlineBox.left === inlineBox.left
                : group[0].inlineBox.top === inlineBox.top
            )
          ) {
            switch (textDecoration) {
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
        const {
          computedStyle: style,
          isVertical,
          underlinePosition,
          underlineThickness,
          strikeoutPosition,
          strikeoutSize,
        } = group[0]

        const {
          color,
          textDecoration,
        } = style

        const inlineBox = BoundingBox.from(...group.map(c => c.inlineBox))

        const { left, top, width, height } = inlineBox

        let position = isVertical ? (left + width) : top
        const direction = isVertical ? -1 : 1
        let thickness = 0
        switch (textDecoration) {
          case 'overline':
            thickness = underlineThickness * 2
            break
          case 'underline':
            position += direction * underlinePosition
            thickness = underlineThickness * 2
            break
          case 'line-through':
            position += direction * strikeoutPosition
            thickness = strikeoutSize * 2
            break
        }

        position -= thickness

        let path
        if (isVertical) {
          path = new Path2D([
            { type: 'M', x: position, y: top },
            { type: 'L', x: position, y: top + height },
            { type: 'L', x: position + thickness, y: top + height },
            { type: 'L', x: position + thickness, y: top },
            { type: 'Z' },
          ], {
            fill: color,
          })
        }
        else {
          path = new Path2D([
            { type: 'M', x: left, y: position },
            { type: 'L', x: left + width, y: position },
            { type: 'L', x: left + width, y: position + thickness },
            { type: 'L', x: left, y: position + thickness },
            { type: 'Z' },
          ], {
            fill: color,
          })
        }
        pathSet.paths.push(path)
      })
    },
    render: (ctx, text) => {
      const { effects, computedStyle: style } = text
      if (effects) {
        effects.forEach((effectStyle) => {
          ctx.save()
          const [a, c, e, b, d, f] = getTransform2D(text, effectStyle).transpose().elements
          ctx.transform(a, b, c, d, e, f)
          pathSet.paths.forEach((path) => {
            drawPath({
              ctx,
              path,
              fontSize: style.fontSize,
              ...effectStyle,
            })
          })
          ctx.restore()
        })
      }
      else {
        pathSet.paths.forEach((path) => {
          drawPath({
            ctx,
            path,
            fontSize: style.fontSize,
          })
        })
      }
    },
  })
}
