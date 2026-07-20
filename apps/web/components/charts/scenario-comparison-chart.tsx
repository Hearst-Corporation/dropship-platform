'use client'

import { Group } from '@visx/group'
import { Bar } from '@visx/shape'
import { scaleLinear, scaleBand } from '@visx/scale'
import { AxisLeft, AxisBottom } from '@visx/axis'
import { GridRows } from '@visx/grid'
import { ParentSize } from '@visx/responsive'

export type ScenarioComparisonData = {
  scenario: string
  moic: number
}

export function ScenarioComparisonChart({ data }: { data: ScenarioComparisonData[] }) {
  if (data.length === 0) return null

  return (
    <div className="h-[280px] w-full" role="img" aria-label="Scenario comparison (MOIC)">
      <ParentSize debounceTime={0} enableDebounceLeadingCall>
        {({ width, height }) => {
          if (width < 10 || height < 10) return null

          const margin = { top: 20, right: 20, bottom: 40, left: 40 }
          const xMax = width - margin.left - margin.right
          const yMax = height - margin.top - margin.bottom

          const maxVal = Math.max(0, ...data.map((d) => d.moic))

          const xScale = scaleBand<string>({
            range: [0, xMax],
            domain: data.map((d) => d.scenario),
            padding: 0.4,
          })

          const yScale = scaleLinear<number>({
            range: [yMax, 0],
            domain: [0, maxVal * 1.1],
            nice: true,
          })

          const zeroY = yScale(0) ?? 0

          return (
            <svg width={width} height={height} className="overflow-visible">
              <Group left={margin.left} top={margin.top}>
                <GridRows scale={yScale} width={xMax} strokeOpacity={0.1} stroke="var(--color-zinc-600)" />
                
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
                  stroke="var(--color-zinc-600)" 
                  tickStroke="var(--color-zinc-600)" 
                  tickLabelProps={{ fill: 'var(--color-zinc-500)', fontSize: 10, textAnchor: 'middle' }} 
                  hideAxisLine
                  hideTicks
                />

                <line x1={0} x2={xMax} y1={zeroY} y2={zeroY} stroke="var(--color-zinc-600)" strokeOpacity={0.3} />

                {data.map((d) => {
                  const barWidth = xScale.bandwidth()
                  const barX = xScale(d.scenario) ?? 0
                  const barY = d.moic >= 0 ? yScale(d.moic) : zeroY
                  const barHeight = Math.abs((yScale(d.moic) ?? 0) - zeroY)
                  return (
                    <Bar
                      key={`bar-${d.scenario}`}
                      x={barX}
                      y={barY}
                      width={barWidth}
                      height={Math.max(barHeight, 1)}
                      fill={d.scenario === 'Base' ? 'var(--color-accent-500)' : 'var(--color-zinc-500)'}
                      rx={2}
                    />
                  )
                })}
              </Group>
            </svg>
          )
        }}
      </ParentSize>
      <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">Multiple on Invested Capital (MOIC)</p>
    </div>
  )
}
