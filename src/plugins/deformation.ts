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
      deformer.deform()
      // 变形把字形移到了新位置;若不同步,boundingBox 会并入变形前的原始布局框
      // (rawGlyphBox / lineBox),在大幅位移时(尤其竖排)留下大片空白。
      // 这里用变形后的字形范围覆盖这几个文本级外接框。
      const box = text.getGlyphBox()
      text.rawGlyphBox = box
      text.glyphBox = box
      text.lineBox = box
    },
  })
}
