"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AXIS_TICK, DEFAULT_COLORS } from "@/lib/charts/tokens";

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
    <div className="rounded border border-admin-border bg-admin-surface-inset px-3 py-2 text-xs text-zinc-100 shadow-lg">
      {label !== undefined && (
        <div className="mb-1 font-medium text-zinc-400">{label}</div>
      )}
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2">
          <span
            className="inline-block size-2 rounded-full"
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
      className="flex items-center justify-center bg-admin-surface-inset text-admin-kicker font-bold uppercase tracking-widest text-zinc-500"
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
        <XAxis
          dataKey={xKey}
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={false}
        />
        <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={44} />
        <Tooltip
          content={<DarkTooltip />}
          cursor={{ stroke: "rgba(255,255,255,0.05)", strokeWidth: 2 }}
        />
        <Legend
          wrapperStyle={{
            fontSize: 10,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            fontWeight: 600,
            color: "#71717a",
          }}
          iconType="rect"
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
              fill="transparent"
              activeDot={{ r: 4, strokeWidth: 0, fill: color }}
              dot={false}
            />
          );
        })}
      </AreaChart>
    </ResponsiveContainer>
  );
}
