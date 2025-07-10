import type { HighlightLine, NormalizedHighlight, NormalizedStyle } from 'modern-idoc'
import type { Character } from '../content'
import type { TextPlugin } from '../types'
import { isNone } from 'modern-idoc'
import { BoundingBox, Matrix3, Path2DSet } from 'modern-path2d'
import { drawPath } from '../canvas'
import { definePlugin } from '../definePlugin'
import {
  createSVGLoader,
  createSVGParser,
  isEqualValue,
  parseColormap,
  parseValueNumber,
} from '../utils'

export function getHighlightStyle(style: NormalizedStyle): NormalizedHighlight {
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

export function highlightPlugin(): TextPlugin {
  const pathSet = new Path2DSet()
  const clipRects: (BoundingBox | undefined)[] = []
  const loader = createSVGLoader()
  const parser = createSVGParser(loader)

  return definePlugin({
    name: 'highlight',
    pathSet,
    load: async (text) => {
      const set = new Set<string>()
      text.forEachCharacter((character) => {
        const { computedStyle: style } = character
        const { image, referImage } = getHighlightStyle(style)
        if (image && loader.needsLoad(image)) {
          set.add(image)
        }
        if (referImage && loader.needsLoad(referImage)) {
          set.add(referImage)
        }
      })
      await Promise.all(Array.from(set).map(src => loader.load(src)))
    },
    update: (text) => {
      clipRects.length = 0
      pathSet.paths.length = 0
      let groups: Character[][] = []
      let group: Character[]
      let prevHighlight: NormalizedHighlight | undefined
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
          const { inlineBox, isVertical } = character
          const { fontSize } = style

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
        const groupBox = BoundingBox.from(...characters.map(c => c.compatibleGlyphBox))

        if (!groupBox.height || !groupBox.width) {
          continue
        }

        const {
          computedStyle: style,
          isVertical,
          inlineBox,
          compatibleGlyphBox: glyphBox,
          strikeoutPosition,
          underlinePosition,
        } = char

        const { fontSize } = style

        const {
          image,
          referImage,
          colormap,
          line,
          size,
          thickness,
        } = getHighlightStyle(style)

        const _thickness = parseValueNumber(thickness, { fontSize, total: groupBox.width }) / groupBox.width
        const _colormap = parseColormap(colormap)
        const { pathSet: imagePathSet, dom: imageDom } = parser.parse(image)
        const imageBox = imagePathSet.getBoundingBox(true)!
        const styleScale = fontSize / imageBox.width * 2
        const targetBox = new BoundingBox().copy(groupBox)
        if (isVertical) {
          targetBox.width = groupBox.height
          targetBox.height = groupBox.width
          targetBox.left = groupBox.left + groupBox.width
        }
        const rawWidth = Math.floor(targetBox.width)
        let userWidth = rawWidth
        if (size !== 'cover') {
          userWidth = parseValueNumber(size, { fontSize, total: groupBox.width }) || rawWidth
          targetBox.width = userWidth
        }
        const hasReferImage = !isNone(referImage) && isNone(line)
        if (hasReferImage) {
          imageBox.copy(
            parser
              .parse(referImage)
              .pathSet
              .getBoundingBox(true)!,
          )
        }
        else {
          let _line: Omit<HighlightLine, 'none'>
          if (isNone(line)) {
            if (imageBox.width / imageBox.height > 4) {
              _line = 'underline'
              const viewBox = imageDom.getAttribute('viewBox')
              if (viewBox) {
                const [_x, y, _w, h] = viewBox.split(' ').map(v => Number(v))
                const viewCenter = y + h / 2
                if (imageBox.y < viewCenter && imageBox.y + imageBox.height > viewCenter) {
                  _line = 'line-through'
                }
                else if (imageBox.y + imageBox.height < viewCenter) {
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
              const paddingX = targetBox.width * 0.2
              const paddingY = targetBox.height * 0.2
              if (isVertical) {
                targetBox.x -= paddingY / 2
                targetBox.y -= paddingX / 2
                targetBox.x -= targetBox.height
              }
              else {
                targetBox.x -= paddingX / 2
                targetBox.y -= paddingY / 2
              }
              targetBox.width += paddingX
              targetBox.height += paddingY
              break
            }
            case 'overline':
              targetBox.height = imageBox.height * styleScale
              if (isVertical) {
                targetBox.x = inlineBox.left + inlineBox.width
              }
              else {
                targetBox.y = inlineBox.top
              }
              break
            case 'line-through':
              targetBox.height = imageBox.height * styleScale
              if (isVertical) {
                targetBox.x = inlineBox.left + inlineBox.width - strikeoutPosition + targetBox.height / 2
              }
              else {
                targetBox.y = inlineBox.top + strikeoutPosition - targetBox.height / 2
              }
              break
            case 'underline':
              targetBox.height = imageBox.height * styleScale
              if (isVertical) {
                targetBox.x = glyphBox.left + glyphBox.width - underlinePosition
              }
              else {
                targetBox.y = inlineBox.top + underlinePosition
              }
              break
          }
        }

        const transform = new Matrix3()
        transform.translate(-imageBox.x, -imageBox.y)
        transform.scale(targetBox.width / imageBox.width, targetBox.height / imageBox.height)
        if (isVertical) {
          const tx = targetBox.width / 2
          const ty = targetBox.height / 2
          if (!hasReferImage) {
            transform.translate(-tx, -ty)
          }
          transform.rotate(-Math.PI / 2)
          if (!hasReferImage) {
            transform.translate(ty, tx)
          }
        }
        transform.translate(targetBox.x, targetBox.y)

        for (let i = 0; i < Math.ceil(rawWidth / userWidth); i++) {
          const _transform = transform.clone()
          if (isVertical) {
            _transform.translate(0, i * targetBox.width)
          }
          else {
            _transform.translate(i * targetBox.width, 0)
          }
          imagePathSet.paths.forEach((originalPath) => {
            const path = originalPath.clone().applyTransform(_transform)
            if (path.style.strokeWidth)
              path.style.strokeWidth *= styleScale * _thickness
            if (path.style.strokeMiterlimit)
              path.style.strokeMiterlimit *= styleScale
            if (path.style.strokeDashoffset)
              path.style.strokeDashoffset *= styleScale
            if (path.style.strokeDasharray)
              path.style.strokeDasharray = path.style.strokeDasharray.map(v => v * styleScale)
            if (path.style.fill && (path.style.fill as string) in _colormap) {
              path.style.fill = _colormap[path.style.fill as string]
            }
            if (path.style.stroke && (path.style.stroke as string) in _colormap) {
              path.style.stroke = _colormap[path.style.stroke as string]
            }
            pathSet.paths.push(path)
            if (rawWidth !== userWidth) {
              if (isVertical) {
                clipRects[pathSet.paths.length - 1] = new BoundingBox(
                  groupBox.left - groupBox.width * 2,
                  groupBox.top,
                  groupBox.width * 4,
                  groupBox.height,
                )
              }
              else {
                clipRects[pathSet.paths.length - 1] = new BoundingBox(
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
    getBoundingBox: () => {
      const boundingBoxs: BoundingBox[] = []
      pathSet.paths.forEach((path, index) => {
        const clipRect = clipRects[index]
        let box = path.getBoundingBox()
        if (clipRect) {
          const x = Math.max(box.x, clipRect.x)
          const y = Math.max(box.y, clipRect.y)
          const right = Math.min(box.right, clipRect.right)
          const bottom = Math.min(box.bottom, clipRect.bottom)
          box = new BoundingBox(x, y, right - x, bottom - y)
        }
        boundingBoxs.push(box)
      })
      return BoundingBox.from(...boundingBoxs)
    },
    render: (ctx, text) => {
      pathSet.paths.forEach((path, index) => {
        drawPath({
          ctx,
          path,
          fontSize: text.computedStyle.fontSize,
          clipRect: clipRects[index],
        })

        if (text.debug) {
          const box = new Path2DSet([path]).getBoundingBox()
          if (box) {
            ctx.strokeRect(box.x, box.y, box.width, box.height)
          }
        }
      })
    },
  })
}
