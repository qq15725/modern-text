import type { FullStyle, NormalizedFill, NormalizedOutline, NormalizedStyle } from 'modern-idoc'
import type { Text } from '../Text'
import type { Fragment } from './Fragment'
import { clearUndef } from 'modern-idoc'
import { BoundingBox } from 'modern-path2d'

export class Paragraph {
  lineBox = new BoundingBox()
  fragments: Fragment[] = []
  fill?: NormalizedFill
  outline?: NormalizedOutline

  // 增量布局缓存（见 Text._update / Measurer）：
  // _layoutDirty=true 时须全量重排该段；为 false（复用未变段）时，measurer 仅按 dy 平移。
  // _layoutTop/_layoutHeight/_layoutRight 记录上次测量的绝对 y 顶/高/右，供平移与并集复用。
  // _glyphBox 缓存该段字形包围盒（绝对坐标），平移时随段一起移，免去逐字 union。
  _layoutDirty = true
  _layoutTop = 0
  _layoutHeight = 0
  _layoutRight = 0
  _glyphBox?: BoundingBox
  // 本段是否「有效测量」：含字符却所有字形 advance 为 0（字体未就绪时的退化测量）则为 false，
  // 不可作为增量复用基准，须下次重测，避免把字体就绪前的零宽布局固化。
  _layoutValid = false

  declare computedStyle: FullStyle
  declare computedFill: NormalizedFill | undefined
  declare computedOutline: NormalizedOutline | undefined

  constructor(
    readonly style: NormalizedStyle,
    readonly index: number,
    readonly parent: Text,
  ) {
    this.update()
  }

  update(): this {
    this.computedStyle = {
      ...clearUndef(this.parent.computedStyle),
      ...clearUndef(this.style),
    } as FullStyle

    const fill = this.fill ?? this.parent.computedFill
    this.computedFill = fill ? clearUndef(fill) as NormalizedFill : undefined

    const outline = this.outline ?? this.parent.computedOutline
    this.computedOutline = outline ? clearUndef(outline) as NormalizedOutline : undefined

    return this
  }
}
