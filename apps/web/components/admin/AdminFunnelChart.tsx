'use client'

import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { AXIS_TICK, ChartEmptyState, FUNNEL_COLORS } from './chart-theme'

export interface AdminFunnelStep {
  label: string
  value: number
}

export interface AdminFunnelChartProps {
  steps: AdminFunnelStep[]
  height?: number
}

function FunnelTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{ payload?: AdminFunnelStep & { conv?: string | null } }>
}) {
  if (!active || !payload || payload.length === 0) return null
  const point = payload[0]?.payload
  if (!point) return null
  return (
    <div className="rounded border border-zinc-950/10 bg-white px-3 py-2 text-xs text-zinc-950 shadow-lg dark:border-white/10 dark:bg-zinc-800 dark:text-zinc-100">
      <div className="mb-1 font-medium text-zinc-500 dark:text-zinc-300">{point.label}</div>
      <div className="flex items-center gap-2">
        <span className="text-zinc-500 dark:text-zinc-400">Volume</span>
        <span className="ml-auto pl-4 font-medium tabular-nums">{point.value}</span>
      </div>
      {point.conv != null && (
        <div className="flex items-center gap-2">
          <span className="text-zinc-500 dark:text-zinc-400">Conversion</span>
          <span className="ml-auto pl-4 font-medium tabular-nums">{point.conv}%</span>
        </div>
      )}
    </div>
  )
}

export function AdminFunnelChart({ steps, height = 280 }: AdminFunnelChartProps) {
  if (!steps || steps.length === 0) {
    return <ChartEmptyState height={height} />
  }

  // Repère de conversion subtil : chaque étape rapportée à la première.
  const top = steps[0]?.value ?? 0
  const data = steps.map((s) => ({
    ...s,
    conv: top > 0 ? ((s.value / top) * 100).toFixed(1) : null,
  }))

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 48, left: 8, bottom: 4 }}
        barCategoryGap="28%"
      >
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="label"
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={false}
          width={128}
        />
        <Tooltip content={<FunnelTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
        <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={26}>
          {data.map((_, i) => (
            <Cell key={i} fill={FUNNEL_COLORS[i % FUNNEL_COLORS.length]} />
          ))}
          <LabelList dataKey="value" position="right" style={{ fill: '#e4e4e7', fontSize: 12 }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

export default AdminFunnelChart
