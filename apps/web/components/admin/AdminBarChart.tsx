"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/** Palette par défaut, lisible sur une surface zinc-900 sombre. */
const DEFAULT_COLORS = ["#6366f1", "#10b981", "#f59e0b", "#38bdf8"];

const AXIS_TICK = { fill: "#a1a1aa", fontSize: 12 };
const GRID_STROKE = "rgba(255,255,255,0.08)";

export interface AdminBarSeries {
  key: string;
  label: string;
  color?: string;
}

export interface AdminBarChartProps {
  data: Array<Record<string, unknown>>;
  xKey: string;
  bars: AdminBarSeries[];
  height?: number;
}

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
    <div className="rounded border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs text-zinc-100 shadow-lg">
      {label !== undefined && (
        <div className="mb-1 font-medium text-zinc-400">{label}</div>
      )}
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2">
          <span
            className="inline-block size-2 rounded-sm"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-zinc-400">{entry.name}</span>
          <span className="ml-auto font-medium tabular-nums">
            {entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ height }: { height: number }) {
  return (
    <div
      className="flex items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-sm text-zinc-500"
      style={{ height }}
    >
      Pas encore de données
    </div>
  );
}

export default function AdminBarChart({
  data,
  xKey,
  bars,
  height = 280,
}: AdminBarChartProps) {
  if (!data || data.length === 0 || !bars || bars.length === 0) {
    return <EmptyState height={height} />;
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={GRID_STROKE} vertical={false} />
        <XAxis
          dataKey={xKey}
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={{ stroke: GRID_STROKE }}
        />
        <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={44} />
        <Tooltip
          content={<DarkTooltip />}
          cursor={{ fill: "rgba(255,255,255,0.04)" }}
        />
        <Legend
          wrapperStyle={{ fontSize: 12, color: "#a1a1aa" }}
          iconType="circle"
        />
        {bars.map((b, i) => (
          <Bar
            key={b.key}
            dataKey={b.key}
            name={b.label}
            fill={b.color ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length]}
            radius={[3, 3, 0, 0]}
            maxBarSize={40}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
