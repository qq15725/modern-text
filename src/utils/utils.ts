import { isNone } from 'modern-idoc'

interface ValueContext {
  total: number
  fontSize: number
}

export function parseValueNumber(value: string | number, ctx: ValueContext): number {
  if (typeof value === 'number') {
    return value
  }
  else {
    if (value.endsWith('%')) {
      value = value.substring(0, value.length - 1)
      return Math.ceil(Number(value) / 100 * ctx.total)
    }
    else if (value.endsWith('rem')) {
      value = value.substring(0, value.length - 3)
      return Number(value) * ctx.fontSize
    }
    else if (value.endsWith('em')) {
      value = value.substring(0, value.length - 2)
      return Number(value) * ctx.fontSize
    }
    else {
      return Number(value)
    }
  }
}

export function parseColormap(colormap: 'none' | Record<string, string>): Record<string, string> {
  return (isNone(colormap) ? {} : colormap) as Record<string, string>
}

export function isEqualObject(obj1: Record<string, any>, obj2: Record<string, any>): boolean {
  const keys1 = Object.keys(obj1)
  const keys2 = Object.keys(obj2)
  const keys = Array.from(new Set([...keys1, ...keys2]))
  return keys.every(key => isEqualValue(obj1[key], obj2[key]))
}

export function isEqualValue(val1: any, val2: any): boolean {
  const typeof1 = typeof val1
  const typeof2 = typeof val2
  if (typeof1 === typeof2) {
    if (typeof1 === 'object') {
      return isEqualObject(val1, val2)
    }
    return val1 === val2
  }
  return false
}

export function hexToRgb(hex: string): string | null {
  const cleanHex = hex.startsWith('#') ? hex.slice(1) : hex
  const isValidHex = /^(?:[0-9A-F]{3}|[0-9A-F]{6})$/i.test(cleanHex)
  if (!isValidHex)
    return null
  const fullHex = cleanHex.length === 3
    ? cleanHex.split('').map(char => char + char).join('')
    : cleanHex
  const r = Number.parseInt(fullHex.slice(0, 2), 16)
  const g = Number.parseInt(fullHex.slice(2, 4), 16)
  const b = Number.parseInt(fullHex.slice(4, 6), 16)
  return `rgb(${r}, ${g}, ${b})`
}

export function filterEmpty(val: Record<string, any> | undefined): Record<string, any> | undefined {
  if (!val)
    return val
  const res: Record<string, any> = {}
  for (const key in val) {
    if (val[key] !== '' && val[key] !== undefined) {
      res[key] = val[key]
    }
  }
  return res
}
