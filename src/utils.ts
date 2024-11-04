export function isNone(val: string | undefined): boolean {
  return !val || val === 'none'
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
