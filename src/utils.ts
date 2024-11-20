export function isNone(val: string | undefined): boolean {
  return !val || val === 'none'
}

export function isEqualObject(obj1: Record<string, any>, obj2: Record<string, any>): boolean {
  const keys1 = Object.keys(obj1)
  const keys2 = Object.keys(obj2)
  const keys = Array.from(new Set([...keys1, ...keys2]))
  return keys.every(key => obj1[key] === obj2[key])
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
