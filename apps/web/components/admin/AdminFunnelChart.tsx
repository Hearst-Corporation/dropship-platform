'use client';

import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

/** Dégradé indigo -> sky pour les étapes du funnel. */
const STEP_COLORS = ['#6366f1', '#5b74f2', '#4f8cf3', '#43a4f5', '#38bdf8'];

const AXIS_TICK = { fill: '#a1a1aa', fontSize: 12 };

export interface AdminFunnelStep {
  label: string;
  value: number;
}

export interface AdminFunnelChartProps {
  steps: AdminFunnelStep[];
  height?: number;
}

function EmptyState({ height }: { height: number }) {
  return (
    <div
      className="flex items-center justify-center rounded-lg border border-white/10 bg-zinc-900 text-sm text-zinc-500"
      style={{ height }}
    >
      Pas encore de données
    </div>
  );
}

function FunnelTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload?: AdminFunnelStep & { conv?: string | null } }>;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0]?.payload;
  if (!point) return null;
  return (
    <div className="rounded border border-white/10 bg-zinc-800 px-3 py-2 text-xs text-zinc-100 shadow-lg">
      <div className="mb-1 font-medium text-zinc-300">{point.label}</div>
      <div className="flex items-center gap-2">
        <span className="text-zinc-400">Volume</span>
        <span className="ml-auto font-medium tabular-nums">{point.value}</span>
      </div>
      {point.conv != null && (
        <div className="flex items-center gap-2">
          <span className="text-zinc-400">Conversion</span>
          <span className="ml-auto font-medium tabular-nums">{point.conv}%</span>
        </div>
      )}
    </div>
  );
}

export default function AdminFunnelChart({
  steps,
  height = 280,
}: AdminFunnelChartProps) {
  if (!steps || steps.length === 0) {
    return <EmptyState height={height} />;
  }

  // Repère de conversion subtil : chaque étape rapportée à la première.
  const top = steps[0]?.value ?? 0;
  const data = steps.map((s) => ({
    ...s,
    conv: top > 0 ? ((s.value / top) * 100).toFixed(1) : null,
  }));

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
        <Tooltip
          content={<FunnelTooltip />}
          cursor={{ fill: 'rgba(255,255,255,0.04)' }}
        />
        <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={26}>
          {data.map((_, i) => (
            <Cell key={i} fill={STEP_COLORS[i % STEP_COLORS.length]} />
          ))}
          <LabelList
            dataKey="value"
            position="right"
            style={{ fill: '#e4e4e7', fontSize: 12 }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
