'use client';

import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

/** Palette par défaut, lisible sur une surface zinc-900 sombre. */
const DEFAULT_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#38bdf8'];

const AXIS_TICK = { fill: '#a1a1aa', fontSize: 12 };
const GRID_STROKE = 'rgba(255,255,255,0.08)';

export interface AdminTrendSeries {
  key: string;
  label: string;
  color?: string;
}

export interface AdminTrendChartProps {
  data: Array<Record<string, unknown>>;
  xKey: string;
  series: AdminTrendSeries[];
  height?: number;
}

/** Tooltip sombre, cohérent avec le thème admin. */
function DarkTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number | string; color?: string }>;
  label?: string | number;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded border border-white/10 bg-zinc-800 px-3 py-2 text-xs text-zinc-100 shadow-lg">
      {label !== undefined && (
        <div className="mb-1 font-medium text-zinc-300">{label}</div>
      )}
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2">
          <span
            className="inline-block size-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-zinc-400">{entry.name}</span>
          <span className="ml-auto font-medium tabular-nums">{entry.value}</span>
        </div>
      ))}
    </div>
  );
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

export default function AdminTrendChart({
  data,
  xKey,
  series,
  height = 280,
}: AdminTrendChartProps) {
  if (!data || data.length === 0 || !series || series.length === 0) {
    return <EmptyState height={height} />;
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <defs>
          {series.map((s, i) => {
            const color = s.color ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length];
            return (
              <linearGradient
                key={s.key}
                id={`admin-trend-${s.key}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                <stop offset="100%" stopColor={color} stopOpacity={0.02} />
              </linearGradient>
            );
          })}
        </defs>
        <CartesianGrid stroke={GRID_STROKE} vertical={false} />
        <XAxis
          dataKey={xKey}
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={{ stroke: GRID_STROKE }}
        />
        <YAxis
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={false}
          width={44}
        />
        <Tooltip
          content={<DarkTooltip />}
          cursor={{ stroke: 'rgba(255,255,255,0.15)' }}
        />
        <Legend
          wrapperStyle={{ fontSize: 12, color: '#a1a1aa' }}
          iconType="circle"
        />
        {series.map((s, i) => {
          const color = s.color ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length];
          return (
            <Area
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={color}
              strokeWidth={2}
              fill={`url(#admin-trend-${s.key})`}
              activeDot={{ r: 4, strokeWidth: 0 }}
              dot={false}
            />
          );
        })}
      </AreaChart>
    </ResponsiveContainer>
  );
}
