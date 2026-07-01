import type { Plugin } from '../types'
import type { Deformer, DeformerOptions } from './deformers'
import type { DeformationPreset } from './deformers/types'
import { isNone } from 'modern-idoc'
import { definePlugin } from '../definePlugin'
import { BendDeformer, FfdDeformer, VerbatimDeformer } from './deformers'

export { CircleCurve, EllipseCurve, HeartCurve, PolygonCurve, RectangularCurve } from './deformers/curves'
// 对外暴露预设/上下文/配置类型与内置曲线类,供库外部定义预设时使用
export type * from './deformers/types'

/** 全局预设注册表。core 自身不注册任何预设——通过 defineDeformation 从外部透传。 */
const deformationPresets = new Map<string, DeformationPreset>()

/**
 * 注册一个变形预设(库外部定义,运行时透传)。
 * 官方预设包见子入口 `modern-text/deformations`。
 */
export function defineDeformation(name: string, preset: DeformationPreset): void {
  deformationPresets.set(name, preset)
}

/** 取消注册某个预设 */
export function removeDeformation(name: string): void {
  deformationPresets.delete(name)
}

/** 当前已注册的预设名列表 */
export function getDeformationNames(): string[] {
  return [...deformationPresets.keys()]
}

/**
 * 文字变形插件(纯引擎)。
 *
 * 通过 `text.deformation` 指定**已注册**的预设名:
 * ```ts
 * import { registerDeformations } from 'modern-text/deformations'
 * registerDeformations()
 * new Text({ content: 'abc', deformation: { type: 'bend', intensities: [50] } })
 * ```
 */
export function deformationPlugin(): Plugin {
  return definePlugin({
    name: 'deformation',
    updateOrder: 2,
    update: (text) => {
      const config = text.deformation
      const type = config?.type
      if (isNone(type) || !type) {
        return
      }
      const preset = deformationPresets.get(type)
      if (!preset) {
        return
      }
      const options: DeformerOptions = {
        text,
        intensities: config.intensities ?? preset.defaultIntensities,
        maxFontSize: config.maxFontSize,
      }
      let deformer: Deformer
      switch (preset.engine) {
        case 'ffd':
          deformer = new FfdDeformer(options, preset)
          break
        case 'bend':
          deformer = new BendDeformer(options, preset)
          break
        case 'curve':
        case 'offset':
          deformer = new VerbatimDeformer(options, preset)
          break
      }
      // 变形是幂等的几何变换，必须每次从「干净字形」算起：deform 原地改写 glyph path 控制点，
      // 而增量布局会跳过未变段的字形重建、复用上一帧的 path。变形前把每个字符的 path 重置回
      // 当前布局位置上的干净字形（inlineBox 未被变形污染，故定位正确），使变形对 measure 幂等，
      // 且不牺牲增量布局。
      text.forEachCharacter(character => character.update(text.fonts))
      deformer.deform()
      // 变形把字形移到了新位置;若不同步,boundingBox 会并入变形前的原始布局框
      // (rawGlyphBox / lineBox),在大幅位移时(尤其竖排)留下大片空白。
      // 这里用变形后的字形范围覆盖这几个文本级外接框。
      let box = text.getGlyphBox()
      // 归一化:把变形后字形整体平移回本地原点 (0,0)。否则 boundingBox 会带上非零
      // 偏移(如下拱形使顶部下沉令 box.top 变正),而下游按 boundingBox.left/top 定位
      // 字形纹理时(如 modern-canvas Element2DText._textureDraw),元素框从 (0,0) 起算,
      // 二者错位——表现为选框/外框无法贴合变形后的文字。平移范围与 Deformer._transform
      // 保持一致(字符 path + highlight pathSet),并同步各字符的 glyphBox/inlineBox。
      const dx = box.left
      const dy = box.top
      if (dx || dy) {
        const highlight = text.plugins.get('highlight')
        for (const character of text.characters) {
          if (!character.glyphBox) {
            continue
          }
          character.path.getControlPointRefs().forEach((point) => {
            point.set(point.x - dx, point.y - dy)
          })
          // 只同步 glyphBox（变形后的字形框，供 boundingBox / 渲染定位）。不写 inlineBox：
          // 它是布局位置、被增量布局复用，变形污染它会让下一帧基于错位再变形而层层叠加。
          character.glyphBox = character.getGlyphBoundingBox()
        }
        highlight?.pathSet?.paths?.forEach((path) => {
          path.getControlPointRefs().forEach((point) => {
            point.set(point.x - dx, point.y - dy)
          })
        })
        box = text.getGlyphBox()
      }
      text.rawGlyphBox = box
      text.glyphBox = box
      text.lineBox = box
    },
  })
}
