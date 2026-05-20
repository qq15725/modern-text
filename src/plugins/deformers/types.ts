import type { BoundingBox, Vector2, Vector2Like } from 'modern-path2d'
import type { Character } from '../../content'

/** 逐字沿形状排布所需的曲线最小接口（实现了这三个方法即可当作变形曲线） */
export interface DeformationCurve {
  getPointAt: (u: number, output?: Vector2) => Vector2
  getTangent: (t: number, output?: Vector2) => Vector2
  getNormal: (t: number, output?: Vector2) => Vector2
}

/** FFD 预设 `build` 的上下文 */
export interface FfdContext {
  /** 强度 1（intensities[0]，已 /100） */
  a: number
  /** 强度 2（intensities[1]，已 /100） */
  b: number
  baseWidth: number
  baseHeight: number
  lineHeight: number
  /** 沿当前书写方向调整控制点（内部处理横/竖轴向互换） */
  adjust: (point: Vector2Like, dx: number, dy: number) => void
}

/** Bend 预设 `transform` 的上下文（引擎已算好弯曲几何） */
export interface BendContext {
  /** 弯曲半径 */
  lineHeight: number
  size: number
  center: { x: number, y: number }
  centerDist: { x: number, y: number }
  /** 起始角 */
  centerDistAngle: number
  width: number
  height: number
  isHorizontal: boolean
}

/** 逐字预设（offset / curve）的上下文 */
export interface VerbatimContext {
  /** 强度数组（已 /100） */
  intensities: number[]
  baseWidth: number
  lineHeight: number
  isHorizontal: boolean
  boundingBox: BoundingBox
}

/** 逐字 `perChar` 回调拿到的字符信息 */
export interface DeformationCharInfo {
  paragraphIndex: number
  fragmentIndex: number
  characterIndex: number
  character: Character
}

interface PresetBase {
  /** 未显式提供 intensities 时使用的默认值 */
  defaultIntensities?: number[]
}

/** FFD（自由变形）预设：网格规格 + 预处理开关 + 控制点构造 */
export interface FfdPreset extends PresetBase {
  engine: 'ffd'
  /** true=贝塞尔 FFD（需平滑），false=线性 FFD */
  bezier: boolean
  hBlocks: number
  vBlocks: number
  /** 变形前先把字形直线拆段 */
  breakLine?: boolean
  /** 变形前把直线转二次贝塞尔 */
  lineToQuad?: boolean
  build: (points: Vector2[], ctx: FfdContext) => void
}

/** Bend（整体弯曲）预设 */
export interface BendPreset extends PresetBase {
  engine: 'bend'
  /** true=竖向弯曲，false=横向，'auto'/省略=跟随书写方向 */
  vertical?: boolean | 'auto'
  transform: (ctx: BendContext) => (point: Vector2Like) => readonly [number, number]
}

/** 逐字沿曲线排布预设 */
export interface CurvePreset extends PresetBase {
  engine: 'curve'
  /** 字符是否沿切线旋转，默认 true */
  followTangent?: boolean
  /** 是否沿法线方向按 centerDiviation 外扩（多边形需要） */
  expandAlongNormal?: boolean
  makeCurve: (ctx: VerbatimContext) => DeformationCurve
}

/** 逐字位移/旋转预设 */
export interface OffsetPreset extends PresetBase {
  engine: 'offset'
  /** 逐控制点变换；arg 为 perChar 的返回值 */
  point: (point: Vector2Like, arg: any) => readonly [number, number]
  /** 逐字计算参数（透传给 point 的 arg） */
  perChar?: (ctx: VerbatimContext, info: DeformationCharInfo) => any
}

export type DeformationPreset = FfdPreset | BendPreset | CurvePreset | OffsetPreset
