const usdCompact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 })
const usdFull = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })

export function formatAxisUsd(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 1_000_000_000) return `$${usdCompact.format(value)}`
  if (abs >= 1_000_000) return `$${usdCompact.format(value)}`
  return `$${usdFull.format(value)}`
}

export function formatAxisMultiple(value: number): string {
  return `${value.toFixed(1)}×`
}
