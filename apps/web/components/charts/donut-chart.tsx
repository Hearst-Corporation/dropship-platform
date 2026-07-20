'use client'

import { Group } from '@visx/group'
import { Pie } from '@visx/shape'
import { ParentSize } from '@visx/responsive'

export type DonutSegment = {
  label: string
  value: number
  /** Teinte monochrome : plein accent, accent atténué, ou neutre zinc. */
  tone: 'strong' | 'soft' | 'neutral'
}

const FILL: Record<DonutSegment['tone'], string> = {
  strong: 'var(--color-accent-600)',
  soft: 'var(--color-accent-500)',
  neutral: 'var(--color-zinc-700)',
}

const OPACITY: Record<DonutSegment['tone'], number> = {
  strong: 1,
  soft: 0.5,
  neutral: 1,
}

/**
 * Donut monochrome — anneau de composition part-du-tout. Couleurs par variable
 * CSS (aucun hex), mode sombre natif, hauteur fixe, aucun scroll.
 * `centerValue` / `centerLabel` occupent le trou central.
 */
export function DonutChart({
  segments,
  centerValue,
  centerLabel,
}: {
  segments: DonutSegment[]
  centerValue: string
  centerLabel: string
}) {
  const total = segments.reduce((s, d) => s + Math.max(0, d.value), 0)
  if (total <= 0) return null

  return (
    <div className="h-[180px] w-full" role="img" aria-label={`${centerLabel}: ${centerValue}`}>
      <ParentSize debounceTime={0} enableDebounceLeadingCall>
        {({ width, height }) => {
          if (width < 10 || height < 10) return null
          const radius = Math.min(width, height) / 2
          const thickness = Math.max(14, radius * 0.34)

          return (
            <svg width={width} height={height}>
              <Group top={height / 2} left={width / 2}>
                <Pie
                  data={segments}
                  pieValue={(d) => Math.max(0, d.value)}
                  outerRadius={radius}
                  innerRadius={radius - thickness}
                  padAngle={0.02}
                  cornerRadius={2}
                >
                  {(pie) =>
                    pie.arcs.map((arc) => (
                      <path
                        key={arc.data.label}
                        d={pie.path(arc) ?? undefined}
                        fill={FILL[arc.data.tone]}
                        fillOpacity={OPACITY[arc.data.tone]}
                      />
                    ))
                  }
                </Pie>
                <text textAnchor="middle" dy="-0.1em" className="fill-zinc-950 dark:fill-white" fontSize={20} fontWeight={600}>
                  {centerValue}
                </text>
                <text textAnchor="middle" dy="1.4em" className="fill-zinc-500 dark:fill-zinc-400" fontSize={10}>
                  {centerLabel}
                </text>
              </Group>
            </svg>
          )
        }}
      </ParentSize>
    </div>
  )
}

export function DonutLegend({ segments }: { segments: Array<{ label: string; value: string; tone: DonutSegment['tone'] }> }) {
  return (
    <ul className="mt-3 space-y-1.5">
      {segments.map((s) => (
        <li key={s.label} className="flex items-center justify-between gap-2 text-xs">
          <span className="flex min-w-0 items-center gap-1.5 text-zinc-500 dark:text-zinc-400">
            <span
              aria-hidden
              className={
                s.tone === 'strong'
                  ? 'size-2 shrink-0 rounded-full bg-accent-600'
                  : s.tone === 'soft'
                    ? 'size-2 shrink-0 rounded-full bg-accent-500/50'
                    : 'size-2 shrink-0 rounded-full bg-zinc-700'
              }
            />
            <span className="truncate">{s.label}</span>
          </span>
          <span className="shrink-0 font-medium tabular-nums text-zinc-950 dark:text-white">{s.value}</span>
        </li>
      ))}
    </ul>
  )
}
