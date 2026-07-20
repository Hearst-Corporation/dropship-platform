'use client'

import { Group } from '@visx/group'
import { Bar } from '@visx/shape'
import { scaleLinear, scaleBand } from '@visx/scale'
import { AxisLeft, AxisBottom } from '@visx/axis'
import { GridRows } from '@visx/grid'
import { ParentSize } from '@visx/responsive'
import { formatAxisUsd } from '@/lib/charts/format'

export type AnnualMetric = {
  year: number
  value: number
}

export function AnnualMetricChart({
  data,
  label,
  ariaLabel,
}: {
  data: AnnualMetric[]
  label: string
  ariaLabel?: string
}) {
  if (data.length === 0) return null

  return (
    <div className="h-[240px] w-full" aria-label={ariaLabel ?? label} role="img">
      <ParentSize debounceTime={0} enableDebounceLeadingCall>
        {({ width, height }) => {
          if (width < 10 || height < 10) return null

          const margin = { top: 16, right: 16, bottom: 40, left: 60 }
          const xMax = width - margin.left - margin.right
          const yMax = height - margin.top - margin.bottom

          const values = data.map((d) => d.value)
          const minVal = Math.min(0, ...values)
          const maxVal = Math.max(0, ...values)

          const xScale = scaleBand<number>({
            range: [0, xMax],
            domain: data.map((d) => d.year),
            padding: 0.4,
          })

          const yScale = scaleLinear<number>({
            range: [yMax, 0],
            domain: [minVal * 1.1, maxVal * 1.1],
            nice: true,
          })

          const zeroY = yScale(0) ?? 0

          return (
            <svg width={width} height={height} className="overflow-visible">
              <Group left={margin.left} top={margin.top}>
                <GridRows scale={yScale} width={xMax} strokeOpacity={0.1} stroke="var(--color-zinc-600)" />
                
                <AxisLeft 
                  scale={yScale} 
                  tickFormat={(v) => formatAxisUsd(v.valueOf())} 
                  stroke="var(--color-zinc-600)" 
                  tickStroke="var(--color-zinc-600)" 
                  tickLabelProps={{ fill: 'var(--color-zinc-500)', fontSize: 10, textAnchor: 'end', dy: '0.33em' }} 
                  hideAxisLine
                  hideTicks
                />
                
                <AxisBottom 
                  top={yMax} 
                  scale={xScale} 
                  tickFormat={(v) => `Y${v}`} 
                  stroke="var(--color-zinc-600)" 
                  tickStroke="var(--color-zinc-600)" 
                  tickLabelProps={{ fill: 'var(--color-zinc-500)', fontSize: 10, textAnchor: 'middle' }} 
                  hideAxisLine
                  hideTicks
                />

                <line x1={0} x2={xMax} y1={zeroY} y2={zeroY} stroke="var(--color-zinc-600)" strokeOpacity={0.3} />

                {data.map((d) => {
                  const barWidth = xScale.bandwidth()
                  const barX = xScale(d.year) ?? 0
                  const barY = d.value >= 0 ? yScale(d.value) : zeroY
                  const barHeight = Math.abs((yScale(d.value) ?? 0) - zeroY)
                  return (
                    <Bar
                      key={`bar-${d.year}`}
                      x={barX}
                      y={barY}
                      width={barWidth}
                      height={Math.max(barHeight, 1)}
                      fill={d.value >= 0 ? 'var(--color-accent-600)' : 'var(--color-zinc-400)'}
                      rx={2}
                    />
                  )
                })}
              </Group>
            </svg>
          )
        }}
      </ParentSize>
      <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">{label}</p>
    </div>
  )
}
