'use client'

import {
  Bar,
  BarChart,
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

export interface AdminBarSeries {
  key: string
  label: string
  color?: string
}

export interface AdminBarChartProps {
  data: Array<Record<string, unknown>>
  xKey: string
  bars: AdminBarSeries[]
  height?: number
}

export function AdminBarChart({ data, xKey, bars, height = 280 }: AdminBarChartProps) {
  if (!data || data.length === 0 || !bars || bars.length === 0) {
    return <ChartEmptyState height={height} />
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={GRID_STROKE} vertical={false} />
        <XAxis dataKey={xKey} tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: GRID_STROKE }} />
        <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={44} />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
        {bars.length > 1 ? <Legend wrapperStyle={LEGEND_STYLE} iconType="circle" /> : null}
        {bars.map((b, i) => (
          <Bar
            key={b.key}
            dataKey={b.key}
            name={b.label}
            fill={b.color ?? CHART_COLORS[i % CHART_COLORS.length]}
            radius={[3, 3, 0, 0]}
            maxBarSize={40}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}

export default AdminBarChart
