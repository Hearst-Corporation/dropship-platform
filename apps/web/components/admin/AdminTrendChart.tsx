'use client'

import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  AXIS_TICK,
  CHART_COLORS,
  ChartEmptyState,
  ChartTooltip,
  GRID_STROKE,
  LEGEND_STYLE,
} from './chart-theme'

export interface AdminTrendSeries {
  key: string
  label: string
  color?: string
  /** Axe Y de rattachement quand les séries ont des ordres de grandeur différents. */
  yAxisId?: 'left' | 'right'
}

export interface AdminTrendChartProps {
  data: Array<Record<string, unknown>>
  xKey: string
  series: AdminTrendSeries[]
  height?: number
}

export function AdminTrendChart({ data, xKey, series, height = 280 }: AdminTrendChartProps) {
  if (!data || data.length === 0 || !series || series.length === 0) {
    return <ChartEmptyState height={height} />
  }

  const hasRightAxis = series.some((s) => s.yAxisId === 'right')

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: hasRightAxis ? 0 : 12, left: 0, bottom: 0 }}>
        <defs>
          {series.map((s, i) => {
            const color = s.color ?? CHART_COLORS[i % CHART_COLORS.length]
            return (
              <linearGradient key={s.key} id={`admin-trend-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                <stop offset="100%" stopColor={color} stopOpacity={0.02} />
              </linearGradient>
            )
          })}
        </defs>
        <CartesianGrid stroke={GRID_STROKE} vertical={false} />
        <XAxis dataKey={xKey} tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: GRID_STROKE }} />
        <YAxis yAxisId="left" tick={AXIS_TICK} tickLine={false} axisLine={false} width={44} />
        {hasRightAxis ? (
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={false}
            width={40}
          />
        ) : null}
        <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.15)' }} />
        {series.length > 1 ? <Legend wrapperStyle={LEGEND_STYLE} iconType="circle" /> : null}
        {series.map((s, i) => {
          const color = s.color ?? CHART_COLORS[i % CHART_COLORS.length]
          return (
            <Area
              key={s.key}
              yAxisId={s.yAxisId ?? 'left'}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={color}
              strokeWidth={2}
              fill={`url(#admin-trend-${s.key})`}
              activeDot={{ r: 4, strokeWidth: 0 }}
              dot={false}
            />
          )
        })}
      </AreaChart>
    </ResponsiveContainer>
  )
}

export default AdminTrendChart
