'use client';

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from 'recharts';

/**
 * Admin charts — Recharts, dark theme. Replaces the home-made CSS bars.
 * Thin wrappers tuned to the gray-900/indigo admin palette. Client-only.
 */

const AXIS = '#9ca3af'; // gray-400
const GRID = 'rgba(255,255,255,0.08)';
const INDIGO = '#818cf8'; // indigo-400
const INDIGO_STRONG = '#6366f1'; // indigo-500
const TOOLTIP_STYLE = {
  backgroundColor: '#1f2937', // gray-800
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8,
  fontSize: 12,
  color: '#f9fafb',
} as const;

/** Horizontal funnel — one bar per stage, last stage highlighted. */
export function FunnelChart({
  data,
  height = 200,
}: {
  data: Array<{ stage: string; value: number }>;
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
        <CartesianGrid horizontal={false} stroke={GRID} />
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="stage"
          width={120}
          tick={{ fill: AXIS, fontSize: 12 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          cursor={{ fill: 'rgba(255,255,255,0.04)' }}
          formatter={(v) => [Number(v).toLocaleString('fr-FR'), 'Événements']}
        />
        <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={22}>
          {data.map((_, i) => (
            <Cell key={i} fill={i === data.length - 1 ? INDIGO_STRONG : 'rgba(129,140,248,0.45)'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Vertical bar chart — generic categorical series. */
export function BarSeries({
  data,
  height = 220,
  valueLabel = 'Valeur',
}: {
  data: Array<{ label: string; value: number }>;
  height?: number;
  valueLabel?: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 4 }}>
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey="label" tick={{ fill: AXIS, fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: AXIS, fontSize: 11 }} axisLine={false} tickLine={false} width={36} />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          cursor={{ fill: 'rgba(255,255,255,0.04)' }}
          formatter={(v) => [Number(v).toLocaleString('fr-FR'), valueLabel]}
        />
        <Bar dataKey="value" fill={INDIGO} radius={[4, 4, 0, 0]} maxBarSize={48} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Line trend — one or two numeric series over time. */
export function TrendLine({
  data,
  height = 240,
  series,
}: {
  data: Array<Record<string, number | string>>;
  height?: number;
  series: Array<{ key: string; label: string; color?: string }>;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 4 }}>
        <CartesianGrid stroke={GRID} />
        <XAxis dataKey="label" tick={{ fill: AXIS, fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: AXIS, fontSize: 11 }} axisLine={false} tickLine={false} width={44} />
        <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ stroke: GRID }} />
        {series.map((s) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.label}
            stroke={s.color ?? INDIGO}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
