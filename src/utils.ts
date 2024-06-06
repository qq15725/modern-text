export function filterEmpty(val: Record<string, any> | undefined) {
  if (!val) return val
  const res: Record<string, any> = {}
  for (const key in val) {
    if (val[key] !== '' && val[key] !== undefined) {
      res[key] = val[key]
    }
  }
  return res
}
