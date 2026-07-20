export function extent(values: number[]): { min: number; max: number } {
  if (values.length === 0) return { min: 0, max: 1 }
  let min = values[0]!
  let max = values[0]!
  for (const v of values) {
    if (v < min) min = v
    if (v > max) max = v
  }
  return { min, max }
}

/** Pad domain so zero is visible when values cross the axis. */
export function paddedDomain(min: number, max: number, ratio = 0.08): { min: number; max: number } {
  if (min === max) {
    const pad = Math.abs(min) * ratio || 1
    return { min: min - pad, max: max + pad }
  }
  const span = max - min
  const lo = min < 0 ? min - span * ratio : min
  const hi = max > 0 ? max + span * ratio : max
  if (min > 0) return { min: 0, max: hi }
  if (max < 0) return { min: lo, max: 0 }
  return { min: lo, max: hi }
}

export function linearScale(value: number, domain: { min: number; max: number }, range: { min: number; max: number }) {
  const d = domain.max - domain.min || 1
  const t = (value - domain.min) / d
  return range.min + t * (range.max - range.min)
}

export function niceTicks(min: number, max: number, count = 5): number[] {
  const span = max - min || 1
  const raw = span / Math.max(count - 1, 1)
  const mag = 10 ** Math.floor(Math.log10(Math.abs(raw)))
  const step = Math.ceil(raw / mag) * mag
  const start = Math.floor(min / step) * step
  const ticks: number[] = []
  for (let v = start; v <= max + step * 0.01; v += step) ticks.push(v)
  return ticks.length > 0 ? ticks : [min, max]
}
