'use client'

import { Group } from '@visx/group'
import { Bar } from '@visx/shape'
import { scaleLinear, scaleBand } from '@visx/scale'
import { AxisLeft, AxisBottom } from '@visx/axis'
import { GridColumns } from '@visx/grid'
import { ParentSize } from '@visx/responsive'

export type SensitivityData = {
  multiple: number
  moic: number
}

export function SensitivityBarChart({ data }: { data: SensitivityData[] }) {
  if (data.length === 0) return null

  return (
    <div className="h-[240px] w-full" role="img" aria-label="Sensitivity to exit multiple">
      <ParentSize debounceTime={0} enableDebounceLeadingCall>
        {({ width, height }) => {
          if (width < 10 || height < 10) return null

          const margin = { top: 20, right: 20, bottom: 40, left: 40 }
          const xMax = width - margin.left - margin.right
          const yMax = height - margin.top - margin.bottom

          const maxVal = Math.max(0, ...data.map((d) => d.moic))

          const yScale = scaleBand<number>({
            range: [0, yMax],
            domain: data.map((d) => d.multiple),
            padding: 0.4,
          })

          const xScale = scaleLinear<number>({
            range: [0, xMax],
            domain: [0, maxVal * 1.1],
            nice: true,
          })

          const zeroX = xScale(0) ?? 0

          return (
            <svg width={width} height={height} className="overflow-visible">
              <Group left={margin.left} top={margin.top}>
                <GridColumns scale={xScale} height={yMax} strokeOpacity={0.1} stroke="var(--color-zinc-600)" />
                
                <AxisLeft 
                  scale={yScale} 
                  tickFormat={(v) => `${v.valueOf()}×`} 
                  stroke="var(--color-zinc-600)" 
                  tickStroke="var(--color-zinc-600)" 
                  tickLabelProps={{ fill: 'var(--color-zinc-500)', fontSize: 10, textAnchor: 'end', dy: '0.33em' }} 
                  hideAxisLine
                  hideTicks
                />
                
                <AxisBottom 
                  top={yMax} 
                  scale={xScale} 
                  tickFormat={(v) => `${v.valueOf()}×`} 
                  stroke="var(--color-zinc-600)" 
                  tickStroke="var(--color-zinc-600)" 
                  tickLabelProps={{ fill: 'var(--color-zinc-500)', fontSize: 10, textAnchor: 'middle' }} 
                  hideAxisLine
                  hideTicks
                />

                <line x1={zeroX} x2={zeroX} y1={0} y2={yMax} stroke="var(--color-zinc-600)" strokeOpacity={0.3} />

                {data.map((d) => {
                  const barHeight = yScale.bandwidth()
                  const barY = yScale(d.multiple) ?? 0
                  const barX = zeroX
                  const barWidth = Math.abs((xScale(d.moic) ?? 0) - zeroX)
                  return (
                    <Bar
                      key={`bar-${d.multiple}`}
                      x={barX}
                      y={barY}
                      width={Math.max(barWidth, 1)}
                      height={barHeight}
                      fill="var(--color-zinc-500)"
                      rx={2}
                    />
                  )
                })}
              </Group>
            </svg>
          )
        }}
      </ParentSize>
      <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">Exit Multiple vs MOIC</p>
    </div>
  )
}
