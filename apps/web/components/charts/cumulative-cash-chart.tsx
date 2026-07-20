'use client'

import { Group } from '@visx/group'
import { Bar, LinePath, AreaClosed } from '@visx/shape'
import { scaleLinear, scaleBand } from '@visx/scale'
import { AxisLeft, AxisBottom } from '@visx/axis'
import { GridRows } from '@visx/grid'
import { ParentSize } from '@visx/responsive'
import { curveMonotoneX } from '@visx/curve'
import { formatAxisUsd } from '@/lib/charts/format'

export type CashFlowYear = {
  year: number
  cashNet: number
  cumCashNet: number
}

export function CumulativeCashChart({ years }: { years: CashFlowYear[] }) {
  if (years.length === 0) return null

  return (
    <div className="h-[320px] w-full">
      <ParentSize debounceTime={0} enableDebounceLeadingCall>
        {({ width, height }) => {
          if (width < 10 || height < 10) return null

          const margin = { top: 20, right: 20, bottom: 40, left: 60 }
          const xMax = width - margin.left - margin.right
          const yMax = height - margin.top - margin.bottom

          const values = years.flatMap((y) => [y.cashNet, y.cumCashNet])
          const minVal = Math.min(0, ...values)
          const maxVal = Math.max(0, ...values)

          const xScale = scaleBand<number>({
            range: [0, xMax],
            domain: years.map((d) => d.year),
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

                {years.map((d) => {
                  const barWidth = xScale.bandwidth()
                  const barX = xScale(d.year) ?? 0
                  const barY = d.cashNet >= 0 ? yScale(d.cashNet) : zeroY
                  const barHeight = Math.abs((yScale(d.cashNet) ?? 0) - zeroY)
                  return (
                    <Bar
                      key={`bar-${d.year}`}
                      x={barX}
                      y={barY}
                      width={barWidth}
                      height={Math.max(barHeight, 1)}
                      fill={d.cashNet >= 0 ? 'var(--color-accent-500)' : 'var(--color-zinc-500)'}
                      rx={2}
                    />
                  )
                })}

                <AreaClosed
                  data={years}
                  x={(d) => (xScale(d.year) ?? 0) + xScale.bandwidth() / 2}
                  y={(d) => yScale(d.cumCashNet) ?? 0}
                  yScale={yScale}
                  curve={curveMonotoneX}
                  fill="var(--color-accent-600)"
                  fillOpacity={0.15}
                />

                <LinePath
                  data={years}
                  x={(d) => (xScale(d.year) ?? 0) + xScale.bandwidth() / 2}
                  y={(d) => yScale(d.cumCashNet) ?? 0}
                  curve={curveMonotoneX}
                  stroke="var(--color-accent-600)"
                  strokeWidth={2}
                />
              </Group>
            </svg>
          )
        }}
      </ParentSize>
      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
        <span className="inline-flex items-center gap-2">
          <span className="size-2.5 rounded-sm bg-zinc-700 dark:bg-zinc-300" />
          Annual net cash
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-0.5 w-4 rounded bg-accent-600 dark:bg-accent-500" />
          Cumulative position
        </span>
      </div>
    </div>
  )
}
