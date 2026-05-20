import type { Vector2Like } from 'modern-path2d'
import type {
  BendContext,
  DeformationCharInfo,
  DeformationCurve,
  DeformationPreset,
  FfdContext,
  VerbatimContext,
} from '../plugins/deformers/types'
import { Vector2 } from 'modern-path2d'
import { defineDeformation } from '../plugins/deformation'
import { CircleCurve, EllipseCurve, HeartCurve, PolygonCurve, RectangularCurve } from '../plugins/deformers/curves'

/**
 * modern-text 官方变形预设包(可选)。
 *
 * core 自身不含任何预设;调用 `registerDeformations()` 把这 34 个内置变形
 * 注册到全局,之后即可用 `text.deformation = { type }` 引用。也可从 `deformationPresets`
 * 里挑选单个,用 `defineDeformation(name, preset)` 自行注册。
 */

const BY_WORD = [50, 5, 0, 100]

const PI_DIV_3 = Math.PI / 3

function random(value: number): number {
  const v = Math.sin(value) * 43758.5453123
  return v - Math.trunc(v)
}

// 共享的逐控制点变换 ---------------------------------------------------------
function translatePoint(point: Vector2Like, arg: any): readonly [number, number] {
  return [point.x + arg.translateVec.x, point.y + arg.translateVec.y]
}

function scalePoint(point: Vector2Like, arg: any): readonly [number, number] {
  const { centerX, centerY, t, center } = arg
  return [(point.x - center.x) * t + centerX, (point.y - center.y) * t + centerY]
}

function rotatePoint(point: Vector2Like, arg: any): readonly [number, number] {
  const { cos, sin, center } = arg
  const dx = point.x - center.x
  const dy = point.y - center.y
  return [center.x + dx * cos - dy * sin, center.y + dx * sin + dy * cos]
}

export const deformationPresets: Record<string, DeformationPreset> = {
  // ── Bend(整体弯曲)───────────────────────────────────────────────────
  'bend': {
    engine: 'bend',
    vertical: false,
    transform: (ctx: BendContext) => {
      const { lineHeight, size, center, centerDist, centerDistAngle, width, height } = ctx
      return (point: Vector2Like): readonly [number, number] => {
        const p = lineHeight + (Math.sign(size) * height) / 2 - (point.y - center.y)
        const deg = centerDistAngle + ((point.x - centerDist.x) / width) * 2 * size
        return [centerDist.x + p * Math.cos(deg), centerDist.y + p * Math.sin(deg)]
      }
    },
  },
  'bend-vertical': {
    engine: 'bend',
    vertical: true,
    transform: (ctx: BendContext) => {
      const { lineHeight, size, center, centerDist, centerDistAngle, width, height } = ctx
      return (point: Vector2Like): readonly [number, number] => {
        const p = lineHeight + (Math.sign(size) * width) / 2 + (point.x - center.x)
        const deg = centerDistAngle + ((point.y - centerDist.y) / height) * 2 * size
        return [centerDist.x + p * Math.cos(deg), centerDist.y + p * Math.sin(deg)]
      }
    },
  },
  'arch-curve': {
    engine: 'bend',
    vertical: 'auto',
    transform: (ctx: BendContext) => {
      const { lineHeight, size, center, centerDist, centerDistAngle, width, height, isHorizontal } = ctx
      return isHorizontal
        ? (point: Vector2Like): readonly [number, number] => {
            const p = centerDistAngle + ((point.x - centerDist.x) / width) * 2 * size
            const x = centerDist.x + lineHeight * Math.cos(p)
            const y = centerDist.y + lineHeight * Math.sin(p) - (Math.sign(size) * height) / 2 + (point.y - center.y)
            return [x, y]
          }
        : (point: Vector2Like): readonly [number, number] => {
            const deg = centerDistAngle + ((point.y - centerDist.y) / height) * 2 * size
            const x = centerDist.x + lineHeight * Math.cos(deg) + (Math.sign(size) * width) / 2 + (point.x - center.x)
            const y = centerDist.y + lineHeight * Math.sin(deg)
            return [x, y]
          }
    },
  },

  // ── FFD(自由变形)─────────────────────────────────────────────────────
  'concave-curve': {
    engine: 'ffd',
    bezier: true,
    hBlocks: 1,
    vBlocks: 0,
    lineToQuad: true,
    build: (p: Vector2[], { a, baseHeight, adjust }: FfdContext) => {
      const k = baseHeight * a
      adjust(p[0], 0, -k)
      adjust(p[2], 0, 2 * k)
      adjust(p[4], 0, -k)
      adjust(p[1], 0, k)
      adjust(p[3], 0, -2 * k)
      adjust(p[5], 0, k)
    },
  },
  'upper-arch-curve': {
    engine: 'ffd',
    bezier: true,
    hBlocks: 1,
    vBlocks: 0,
    lineToQuad: true,
    build: (p: Vector2[], { a, baseWidth, baseHeight, adjust }: FfdContext) => {
      const k = (a > 0 ? 0.5 * baseWidth : 2 * baseHeight) * a
      adjust(p[2], 0, -k)
    },
  },
  'lower-arch-curve': {
    engine: 'ffd',
    bezier: true,
    hBlocks: 1,
    vBlocks: 0,
    lineToQuad: true,
    build: (p: Vector2[], { a, baseWidth, baseHeight, adjust }: FfdContext) => {
      const k = (a > 0 ? 0.5 * baseWidth : 2 * baseHeight) * a
      adjust(p[3], 0, +k)
    },
  },
  'bulb-curve': {
    engine: 'ffd',
    bezier: true,
    hBlocks: 1,
    vBlocks: 0,
    lineToQuad: true,
    build: (p: Vector2[], { a, baseHeight, adjust }: FfdContext) => {
      const k = -baseHeight * a
      adjust(p[0], 0, -0.5 * k)
      adjust(p[2], 0, 2 * k)
      adjust(p[4], 0, -0.5 * k)
      adjust(p[1], 0, 0.5 * k)
      adjust(p[3], 0, -2 * k)
      adjust(p[5], 0, 0.5 * k)
    },
  },
  'skew': {
    engine: 'ffd',
    bezier: false,
    hBlocks: 0,
    vBlocks: 0,
    build: (p: Vector2[], { a, b, baseWidth, baseHeight, adjust }: FfdContext) => {
      const k1 = baseHeight * Math.tan(a * PI_DIV_3)
      const k2 = baseWidth * Math.tan(b * PI_DIV_3)
      adjust(p[0], k1, 0)
      adjust(p[2], k1, -k2)
      adjust(p[3], 0, -k2)
    },
  },
  'flag-curve': {
    engine: 'ffd',
    bezier: true,
    hBlocks: 3,
    vBlocks: 0,
    breakLine: true,
    lineToQuad: true,
    build: (p: Vector2[], { a, baseWidth, adjust }: FfdContext) => {
      const k = 0.5 * baseWidth * a
      adjust(p[2], 0, -k)
      adjust(p[3], 0, -k)
      adjust(p[6], 0, k)
      adjust(p[7], 0, k)
    },
  },
  'trapezoid': {
    engine: 'ffd',
    bezier: true,
    hBlocks: 0,
    vBlocks: 1,
    build: (p: Vector2[], { a, b, baseWidth, baseHeight, adjust }: FfdContext) => {
      const k1 = 0.25 * baseWidth * a
      const k2 = 0.5 * baseHeight * b
      const t = 0.5 * (a + 1)
      adjust(p[0], +k1, -k2)
      adjust(p[2], -k1, +k2)
      adjust(p[3], -k1, -k2)
      adjust(p[5], +k1, +k2)
      p[1] = Vector2.lerp(p[2], p[0], t)
      p[4] = Vector2.lerp(p[5], p[3], t)
    },
  },
  'lower-trapezoid': {
    engine: 'ffd',
    bezier: true,
    hBlocks: 1,
    vBlocks: 0,
    build: (p: Vector2[], { a, b, baseWidth, baseHeight, adjust }: FfdContext) => {
      const k1 = baseWidth * Math.tan(a * PI_DIV_3)
      const k2 = baseHeight * b
      const t = 0.5 * (a + 1)
      adjust(p[0], 0, -k2)
      adjust(p[4], 0, -k2)
      adjust(p[a > 0 ? 1 : 5], 0, +Math.abs(k1))
      p[2] = Vector2.lerp(p[0], p[4], t)
      p[3] = Vector2.lerp(p[1], p[5], t)
    },
  },
  'top-trapezoid': {
    engine: 'ffd',
    bezier: true,
    hBlocks: 1,
    vBlocks: 0,
    build: (p: Vector2[], { a, b, baseWidth, baseHeight, adjust }: FfdContext) => {
      const k1 = baseWidth * Math.tan(a * PI_DIV_3)
      const k2 = baseHeight * b
      const t = 0.5 * (a + 1)
      adjust(p[1], 0, +k2)
      adjust(p[5], 0, +k2)
      adjust(p[a > 0 ? 4 : 0], 0, -Math.abs(k1))
      p[2] = Vector2.lerp(p[4], p[0], t)
      p[3] = Vector2.lerp(p[5], p[1], t)
    },
  },
  'horizontal-trapezoid': {
    engine: 'ffd',
    bezier: true,
    hBlocks: 1,
    vBlocks: 0,
    build: (p: Vector2[], { a, b, baseWidth, baseHeight, adjust }: FfdContext) => {
      const k1 = 0.5 * baseWidth * Math.tan(a * PI_DIV_3)
      const k2 = 0.5 * baseHeight * b
      const t = 0.5 + a * 0.5
      adjust(p[a > 0 ? 0 : 4], 0, -Math.sign(a) * k1)
      adjust(p[a > 0 ? 1 : 5], 0, +Math.sign(a) * k1)
      adjust(p[0], 0, -k2)
      adjust(p[1], 0, +k2)
      adjust(p[4], 0, -k2)
      adjust(p[5], 0, +k2)
      p[2] = Vector2.lerp(p[0], p[4], t)
      p[3] = Vector2.lerp(p[1], p[5], t)
    },
  },
  'bevel': {
    engine: 'ffd',
    bezier: false,
    hBlocks: 1,
    vBlocks: 0,
    breakLine: true,
    build: (p: Vector2[], { a, b, baseWidth, baseHeight, adjust }: FfdContext) => {
      const k1 = 0.5 * baseWidth * Math.tan(a * PI_DIV_3)
      const k2 = 0.5 * baseHeight * b
      adjust(p[0], 0, -k2)
      adjust(p[2], 0, -k1 - k2)
      adjust(p[4], 0, -k2)
      adjust(p[1], 0, +k2)
      adjust(p[3], 0, -k1 + k2)
      adjust(p[5], 0, +k2)
    },
  },
  'upper-roof': {
    engine: 'ffd',
    bezier: false,
    hBlocks: 1,
    vBlocks: 0,
    breakLine: true,
    build: (p: Vector2[], { a, b, baseWidth, baseHeight, adjust }: FfdContext) => {
      const k1 = 0.5 * baseWidth * Math.tan(a * PI_DIV_3)
      const k2 = baseHeight * b
      adjust(p[0], 0, +a * baseHeight - k2)
      adjust(p[2], 0, -k1 - k2)
      adjust(p[4], 0, +a * baseHeight - k2)
    },
  },
  'lower-roof': {
    engine: 'ffd',
    bezier: false,
    hBlocks: 1,
    vBlocks: 0,
    breakLine: true,
    build: (p: Vector2[], { a, b, baseWidth, baseHeight, adjust }: FfdContext) => {
      const k1 = 0.5 * baseWidth * Math.tan(a * PI_DIV_3)
      const k2 = baseHeight * b
      adjust(p[1], 0, -a * baseHeight + k2)
      adjust(p[3], 0, +k1 + k2)
      adjust(p[5], 0, -a * baseHeight + k2)
    },
  },
  'angled-projection': {
    engine: 'ffd',
    bezier: false,
    hBlocks: 1,
    vBlocks: 0,
    breakLine: true,
    build: (p: Vector2[], { a, b, baseWidth, baseHeight, adjust }: FfdContext) => {
      const k1 = 0.5 * baseWidth * Math.tan(a * 0.5 * PI_DIV_3)
      const k2 = 0.5 * baseHeight * b
      adjust(p[0], 0, 0.5 * k1 - k2)
      adjust(p[2], 0, -2 * k1 - k2)
      adjust(p[4], 0, 0.5 * k1 - k2)
      adjust(p[1], 0, -0.5 * k1 + k2)
      adjust(p[3], 0, 2 * k1 + k2)
      adjust(p[5], 0, -0.5 * k1 + k2)
    },
  },
  'folded-corner': {
    engine: 'ffd',
    bezier: false,
    hBlocks: 1,
    vBlocks: 0,
    breakLine: true,
    build: (p: Vector2[], { a, b, baseWidth, baseHeight, adjust }: FfdContext) => {
      const k1 = 0.5 * baseWidth * Math.tan(a * 0.5 * PI_DIV_3)
      const k2 = 0.5 * baseHeight * b
      adjust(p[0], 0, -k1 - k2)
      adjust(p[2], 0, 0.5 * k1 - k2)
      adjust(p[4], 0, -k1 - k2)
      adjust(p[1], 0, +k1 + k2)
      adjust(p[3], 0, -0.5 * k1 + k2)
      adjust(p[5], 0, +k1 + k2)
    },
  },
  'lateral-stretching': {
    engine: 'ffd',
    bezier: false,
    hBlocks: 0,
    vBlocks: 0,
    build: (p: Vector2[], { a, baseWidth, adjust }: FfdContext) => {
      const k = 0.5 * baseWidth * a
      adjust(p[0], -k, 0)
      adjust(p[2], k, 0)
      adjust(p[1], -k, 0)
      adjust(p[3], k, 0)
    },
  },
  'vertical-stretching': {
    engine: 'ffd',
    bezier: false,
    hBlocks: 0,
    vBlocks: 0,
    build: (p: Vector2[], { a, baseHeight, adjust }: FfdContext) => {
      const k = 0.5 * baseHeight * a
      adjust(p[0], 0, -k)
      adjust(p[2], 0, -k)
      adjust(p[1], 0, +k)
      adjust(p[3], 0, +k)
    },
  },

  // ── 逐字 · 位移/旋转(offset)──────────────────────────────────────────
  'patchwork-by-word': {
    engine: 'offset',
    defaultIntensities: BY_WORD,
    point: translatePoint,
    perChar: (ctx: VerbatimContext, { character }: DeformationCharInfo) => {
      const { index, fontSize } = character
      const n = 0.5 * (-1) ** (index + 1) * ctx.intensities[0] * fontSize
      return { translateVec: ctx.isHorizontal ? new Vector2(0, -n) : new Vector2(n, 0) }
    },
  },
  'step-by-word': {
    engine: 'offset',
    defaultIntensities: BY_WORD,
    point: translatePoint,
    perChar: (ctx: VerbatimContext, { character }: DeformationCharInfo) => {
      const { left, top } = ctx.boundingBox
      const { center } = character
      const translateVec = ctx.isHorizontal
        ? new Vector2(0, -((center.x - left) * ctx.intensities[0]))
        : new Vector2((center.y - top) * ctx.intensities[0], 0)
      return { translateVec }
    },
  },
  'arch2-by-word': {
    engine: 'offset',
    defaultIntensities: BY_WORD,
    point: translatePoint,
    perChar: (ctx: VerbatimContext, { character }: DeformationCharInfo) => {
      const { left, top } = ctx.boundingBox
      const i = ctx.intensities[0]
      const { center } = character
      let o: number
      let translateVec: Vector2
      if (ctx.isHorizontal) {
        o = (center.x - left) / ctx.baseWidth
        translateVec = new Vector2(0, -(o * (1 - o) * i * ctx.baseWidth))
      }
      else {
        o = (center.y - top) / ctx.baseWidth
        translateVec = new Vector2(o * (1 - o) * i * ctx.baseWidth, 0)
      }
      return { translateVec }
    },
  },
  'wave-by-word': {
    engine: 'offset',
    defaultIntensities: BY_WORD,
    point: translatePoint,
    perChar: (ctx: VerbatimContext, { character }: DeformationCharInfo) => {
      const { width, height, left, top } = ctx.boundingBox
      const i = ctx.intensities[0]
      const { center } = character
      let translateVec: Vector2
      if (ctx.isHorizontal) {
        const l = ((center.x - left) / width) * 2 * Math.PI
        translateVec = new Vector2(0, -(0.25 * Math.sin(l) * i * width))
      }
      else {
        const l = ((center.y - top) / height) * 2 * Math.PI
        translateVec = new Vector2(0.25 * Math.sin(l) * i * height, 0)
      }
      return { translateVec }
    },
  },
  'step-far-and-near-by-word': {
    engine: 'offset',
    defaultIntensities: BY_WORD,
    point: scalePoint,
    perChar: (ctx: VerbatimContext, { character }: DeformationCharInfo) => {
      const { left, top, width, height } = ctx.boundingBox
      const { center } = character
      const s = ctx.intensities[0]
      let l: number
      let centerX: number
      let centerY: number
      if (ctx.isHorizontal) {
        l = (center.x - left) / width
        centerX = (center.x - left) * (s * l + 1 - s) + left
        centerY = center.y
      }
      else {
        l = (center.y - top) / height
        centerX = center.x
        centerY = (center.y - top) * (s * l + 1 - s) + top
      }
      const t = 2 * (l - 0.5) * s + 1
      return { centerX, centerY, t, center }
    },
  },
  'arch-far-and-near-by-word': {
    engine: 'offset',
    defaultIntensities: BY_WORD,
    point: scalePoint,
    perChar: (ctx: VerbatimContext, { character }: DeformationCharInfo) => {
      const { left, top, width, height } = ctx.boundingBox
      const boxCenter = new Vector2(left + 0.5 * width, top + 0.5 * height)
      const n = ctx.intensities[0]
      const { center } = character
      let h: number
      let centerX: number
      let centerY: number
      if (ctx.isHorizontal) {
        h = (2 * Math.abs(center.x - boxCenter.x)) / width
        centerX = (center.x - boxCenter.x) * (-n * h + 1 + n) + boxCenter.x
        centerY = center.y
      }
      else {
        h = (2 * Math.abs(center.y - boxCenter.y)) / height
        centerX = center.x
        centerY = (center.y - boxCenter.y) * (-n * h + 1 + n) + boxCenter.y
      }
      const t = -2 * (h - 0.5) * n + 1
      return { centerX, centerY, t, center }
    },
  },
  'horizontal-rotate-by-word': {
    engine: 'offset',
    defaultIntensities: BY_WORD,
    point: rotatePoint,
    perChar: (ctx: VerbatimContext, { character }: DeformationCharInfo) => {
      const { center } = character
      const s = 0.333 * ctx.intensities[0] * Math.PI
      return { cos: Math.cos(s), sin: Math.sin(s), center }
    },
  },
  'arbitrary-offset-rotate-by-word': {
    engine: 'offset',
    defaultIntensities: BY_WORD,
    point: (point: Vector2Like, arg: any): readonly [number, number] => {
      const { cos, sin, diviate, center, isHorizontal } = arg
      const dx = point.x - center.x
      const dy = point.y - center.y
      if (isHorizontal) {
        return [center.x + dx * cos - dy * sin, center.y + diviate + dx * sin + dy * cos]
      }
      return [center.x + diviate + dx * cos - dy * sin, center.y + dx * sin + dy * cos]
    },
    perChar: (ctx: VerbatimContext, { characterIndex, character }: DeformationCharInfo) => {
      const { fontSize, center } = character
      let o = random(characterIndex * Math.E)
      const e = 0.5 * ctx.intensities[1] * Math.PI * o
      o = random(characterIndex * characterIndex * Math.E)
      const diviate = 0.5 * ctx.intensities[0] * o * fontSize
      return { cos: Math.cos(e), sin: Math.sin(e), diviate, center, isHorizontal: ctx.isHorizontal }
    },
  },

  // ── 逐字 · 沿曲线排布(curve)──────────────────────────────────────────
  'horizontal-curved-rotate-by-word': {
    engine: 'curve',
    followTangent: true,
    defaultIntensities: BY_WORD,
    makeCurve: (ctx: VerbatimContext): DeformationCurve => {
      const { width, height, left, top } = ctx.boundingBox
      const center = new Vector2(left + width / 2, top + height / 2)
      const radius = (ctx.lineHeight * 2) / Math.sin(ctx.intensities[0] * Math.PI * 0.5)
      const e = (0.5 * ctx.baseWidth) / radius
      const l = ctx.isHorizontal ? 0 : 0.5 * Math.PI
      return new CircleCurve(center, radius, l - e, l + e)
    },
  },
  'ellipse-by-word': {
    engine: 'curve',
    followTangent: true,
    defaultIntensities: BY_WORD,
    makeCurve: (ctx: VerbatimContext): DeformationCurve => {
      const { width, height, left, top } = ctx.boundingBox
      const n = ctx.intensities[3] || 0
      let aX: number
      let aY: number
      let xRadius: number
      let yRadius: number
      if (ctx.isHorizontal) {
        aX = left + 0.5 * width
        aY = top
        xRadius = 0.5 * width * ctx.intensities[0]
        yRadius = Math.sqrt(1 - n * n) * xRadius
      }
      else {
        aX = left
        aY = top + 0.5 * height
        yRadius = 0.5 * height * ctx.intensities[0]
        xRadius = Math.sqrt(1 - n * n) * yRadius
      }
      const startAngle = (ctx.intensities[1] / 1.8 + (ctx.isHorizontal ? 1 : 1.5)) * Math.PI
      const endAngle = startAngle + (ctx.intensities[2] / 1.8) * Math.PI
      return new EllipseCurve(new Vector2(aX, aY), xRadius, yRadius, 0, startAngle, endAngle, false)
    },
  },
  'triangle-by-word': {
    engine: 'curve',
    followTangent: true,
    expandAlongNormal: true,
    defaultIntensities: BY_WORD,
    makeCurve: (ctx: VerbatimContext): DeformationCurve => makePolygonCurve(ctx),
  },
  'pentagon-by-word': {
    engine: 'curve',
    followTangent: true,
    expandAlongNormal: true,
    defaultIntensities: BY_WORD,
    makeCurve: (ctx: VerbatimContext): DeformationCurve => makePolygonCurve(ctx),
  },
  'rectangular-by-word': {
    engine: 'curve',
    followTangent: true,
    defaultIntensities: BY_WORD,
    makeCurve: (ctx: VerbatimContext): DeformationCurve => {
      const { center, extent } = shapeBase(ctx)
      const e = ctx.intensities[1]
      const l = ctx.intensities[2]
      const c = l + ctx.intensities[3]
      return new RectangularCurve(center, extent, e, l, c)
    },
  },
  'heart-by-word': {
    engine: 'curve',
    followTangent: true,
    defaultIntensities: BY_WORD,
    makeCurve: (ctx: VerbatimContext): DeformationCurve => {
      const { center, extent } = shapeBase(ctx)
      const ratio = ctx.intensities[1]
      const startNum = ratio + ctx.intensities[2]
      return new HeartCurve(center, extent, ratio, startNum)
    },
  },
}

// 逐字形状预设共用:按书写方向算「形状中心 + 半径(0.5 * 强度0 * 短边)」
function shapeBase(ctx: VerbatimContext): { center: Vector2, extent: number } {
  const { width, height, left, top } = ctx.boundingBox
  const i0 = ctx.intensities[0]
  return ctx.isHorizontal
    ? { center: new Vector2(left + 0.5 * width, top), extent: 0.5 * i0 * width }
    : { center: new Vector2(left, top + 0.5 * height), extent: 0.5 * i0 * height }
}

// triangle / pentagon 共用:边数由 intensities[1] 决定
function makePolygonCurve(ctx: VerbatimContext): DeformationCurve {
  const { center, extent } = shapeBase(ctx)
  const num = ctx.intensities[1] * 100
  const startNum = ctx.intensities[2]
  const endNum = startNum + ctx.intensities[3]
  return new PolygonCurve(center, extent, num, startNum, endNum)
}

/** 把全部官方预设注册到全局注册表 */
export function registerDeformations(): void {
  for (const name in deformationPresets) {
    defineDeformation(name, deformationPresets[name])
  }
}
