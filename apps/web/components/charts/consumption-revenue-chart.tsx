'use client'

import { Group } from '@visx/group'
import { LinePath, AreaClosed, Bar, Line } from '@visx/shape'
import { scaleLinear, scalePoint } from '@visx/scale'
import { AxisLeft, AxisRight, AxisBottom } from '@visx/axis'
import { GridRows } from '@visx/grid'
import { ParentSize } from '@visx/responsive'
import { curveMonotoneX } from '@visx/curve'
import { useTooltip, TooltipWithBounds, defaultStyles } from '@visx/tooltip'
import { localPoint } from '@visx/event'
import { formatAxisUsd } from '@/lib/charts/format'
import { usdFull, mwFmt } from '@/lib/data-center/model/format'
import { PhaseResult, YearRow } from '@/lib/data-center/model/types'
import { ChartLegend } from '@/components/dashboard/chart-legend'

export type ConsumptionRevenueData = {
  label: string
  revenue: number
  consumedMW: number
}

type ConsumptionRevenueChartProps =
  | { years: YearRow[]; phases: PhaseResult[] }
  | { points: ConsumptionRevenueData[] }

const chartStroke = 'var(--color-zinc-600)'
const axisText = 'var(--color-zinc-400)'
const axisAccentText = 'var(--color-accent-400)'
const revenueStroke = 'var(--color-accent-500)'
const revenueFill = 'var(--color-accent-500)'
const loadStroke = 'var(--color-zinc-400)'
const hoverStroke = 'var(--color-zinc-400)'

export function ConsumptionRevenueChart(props: ConsumptionRevenueChartProps) {
  const {
    tooltipData,
    tooltipLeft,
    tooltipTop,
    tooltipOpen,
    showTooltip,
    hideTooltip,
  } = useTooltip<ConsumptionRevenueData>()

  const data: ConsumptionRevenueData[] =
    'points' in props
      ? props.points
      : props.years.map((y) => {
          const consumedMW = props.phases.reduce((sum, p) => {
            if (y.year < p.firstRevenueYear) return sum
            const t = y.year - p.firstRevenueYear
            const r = t <= 0 ? 0.3 : t === 1 ? 0.85 : 1.0
            return sum + p.commercialMW * r
          }, 0)

          return {
            label: `Y${y.year}`,
            revenue: y.totalRev,
            consumedMW,
          }
        })

  if (data.length === 0) return null

  return (
    <div className="relative h-[300px] w-full sm:h-[340px]">
      <ParentSize debounceTime={0} enableDebounceLeadingCall>
        {({ width, height }) => {
          if (width < 10 || height < 10) return null

          const margin = { top: 40, right: 60, bottom: 40, left: 60 }
          const xMax = width - margin.left - margin.right
          const yMax = height - margin.top - margin.bottom

          const maxRev = Math.max(...data.map(d => d.revenue))
          const maxMW = Math.max(...data.map(d => d.consumedMW))

          // padding: 0 — sur une série continue, le premier et le dernier point
          // doivent toucher les bords. Avec padding 0.5 et 5 points, la courbe
          // ne couvrait que 80 % de la largeur et laissait deux vides latéraux.
          const xScale = scalePoint<string>({
            range: [0, xMax],
            domain: data.map((d) => d.label),
            padding: 0,
          })

          const yRevScale = scaleLinear<number>({
            range: [yMax, 0],
            domain: [0, maxRev * 1.2],
            nice: true,
          })

          const yMWScale = scaleLinear<number>({
            range: [yMax, 0],
            domain: [0, maxMW * 1.2],
            nice: true,
          })

          const handleTooltip = (event: React.TouchEvent<SVGRectElement> | React.MouseEvent<SVGRectElement>) => {
            const { x } = localPoint(event) || { x: 0 }
            const xPos = x - margin.left

            let closestData = data[0]
            let minDistance = Infinity

            data.forEach((d) => {
              const dX = xScale(d.label) ?? 0
              const distance = Math.abs(dX - xPos)
              if (distance < minDistance) {
                minDistance = distance
                closestData = d
              }
            })

            if (closestData) {
              showTooltip({
                tooltipData: closestData,
                tooltipLeft: x,
                tooltipTop: (yRevScale(closestData.revenue) ?? 0) + margin.top,
              })
            }
          }

          return (
            <svg width={width} height={height} className="overflow-visible">
              <Group left={margin.left} top={margin.top}>
                <GridRows scale={yRevScale} width={xMax} strokeOpacity={0.08} stroke={chartStroke} />
                
                <AxisLeft 
                  scale={yRevScale} 
                  tickFormat={(v) => formatAxisUsd(v.valueOf())} 
                  stroke={chartStroke} 
                  tickStroke={chartStroke} 
                  tickLabelProps={{ fill: axisAccentText, fontSize: 10, textAnchor: 'end', dy: '0.33em' }} 
                  hideAxisLine
                  hideTicks
                />

                <AxisRight 
                  left={xMax}
                  scale={yMWScale} 
                  tickFormat={(v) => `${v} MW`} 
                  stroke={chartStroke} 
                  tickStroke={chartStroke} 
                  tickLabelProps={{ fill: axisText, fontSize: 10, textAnchor: 'start', dy: '0.33em', dx: '0.5em' }} 
                  hideAxisLine
                  hideTicks
                />
                
                <AxisBottom 
                  top={yMax} 
                  scale={xScale} 
                  stroke={chartStroke} 
                  tickStroke={chartStroke} 
                  tickLabelProps={{ fill: axisText, fontSize: 10, textAnchor: 'middle' }} 
                  hideAxisLine
                  hideTicks
                />

                <AreaClosed
                  data={data}
                  x={(d) => xScale(d.label) ?? 0}
                  y={(d) => yRevScale(d.revenue) ?? 0}
                  yScale={yRevScale}
                  curve={curveMonotoneX}
                  fill={revenueFill}
                  opacity={0.12}
                />
                <LinePath
                  data={data}
                  x={(d) => xScale(d.label) ?? 0}
                  y={(d) => yRevScale(d.revenue) ?? 0}
                  curve={curveMonotoneX}
                  stroke={revenueStroke}
                  strokeWidth={2}
                />

                <LinePath
                  data={data}
                  x={(d) => xScale(d.label) ?? 0}
                  y={(d) => yMWScale(d.consumedMW) ?? 0}
                  curve={curveMonotoneX}
                  stroke={loadStroke}
                  strokeWidth={2}
                  strokeDasharray="4,4"
                />

                <Bar
                  x={0}
                  y={0}
                  width={xMax}
                  height={yMax}
                  fill="transparent"
                  rx={14}
                  onTouchStart={handleTooltip}
                  onTouchMove={handleTooltip}
                  onMouseMove={handleTooltip}
                  onMouseLeave={() => hideTooltip()}
                />

                {tooltipOpen && tooltipData && (
                  <Group>
                    <Line
                      from={{ x: xScale(tooltipData.label) ?? 0, y: 0 }}
                      to={{ x: xScale(tooltipData.label) ?? 0, y: yMax }}
                      stroke={hoverStroke}
                      strokeWidth={1}
                      pointerEvents="none"
                      strokeDasharray="4,4"
                    />
                    <circle
                      cx={xScale(tooltipData.label) ?? 0}
                      cy={yRevScale(tooltipData.revenue) ?? 0}
                      r={4}
                      fill={revenueStroke}
                      stroke="var(--color-white)"
                      strokeWidth={2}
                      pointerEvents="none"
                    />
                    <circle
                      cx={xScale(tooltipData.label) ?? 0}
                      cy={yMWScale(tooltipData.consumedMW) ?? 0}
                      r={4}
                      fill={loadStroke}
                      stroke="var(--color-white)"
                      strokeWidth={2}
                      pointerEvents="none"
                    />
                  </Group>
                )}
              </Group>
            </svg>
          )
        }}
      </ParentSize>
      
      {tooltipOpen && tooltipData && (
        <TooltipWithBounds
          key={`tooltip-${tooltipData.label}`}
          top={tooltipTop}
          left={tooltipLeft}
          style={{
            ...defaultStyles,
            backgroundColor: 'transparent',
            padding: 0,
            boxShadow: 'none',
          }}
        >
          <div className="rounded-md border border-zinc-950/10 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-zinc-900">
            <div className="mb-1 font-medium text-zinc-900 dark:text-zinc-100">
              {tooltipData.label}
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-4">
                <span className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400">
                  <div className="h-2 w-2 rounded-full bg-accent-700" />
                  Revenue
                </span>
                <span className="font-medium tabular-nums text-zinc-900 dark:text-zinc-100">
                  {usdFull(tooltipData.revenue)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400">
                  <div className="h-2 w-2 rounded-full bg-zinc-700 dark:bg-zinc-300" />
                  Consumption
                </span>
                <span className="font-medium tabular-nums text-zinc-900 dark:text-zinc-100">
                  {mwFmt(tooltipData.consumedMW)}
                </span>
              </div>
            </div>
          </div>
        </TooltipWithBounds>
      )}

      <ChartLegend
        className="mt-2"
        items={[
          { label: 'Revenue run-rate', variant: 'accent-solid' },
          { label: 'Operational load', variant: 'zinc-dashed' },
        ]}
      />
    </div>
  )
}

