"use client";

import clsx from "clsx";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  adminChartGridStroke,
  adminChartSurfaceFill,
  adminPopover,
} from "@/components/admin/admin-surface";
import { AXIS_TICK, DEFAULT_COLORS } from "@/lib/design/chart-tokens";
import { formatEur } from "@/lib/format";

/**
 * Client charts for the store campaign page.
 *
 * - PlatformSplitDonut: donut of the daily budget split across Google Ads /
 *   Instagram / TikTok, with the PLATFORM brand colors (explicit operator
 *   exception to the single-accent rule, scoped to this page). The admin is
 *   rendered dark (AdminLayoutClient forces the `dark` class), so TikTok
 *   (#010101) is drawn white here to stay visible.
 * - KpiComparisonChart: projected vs real bars (traffic, conversions), admin
 *   palette (indigo + sky), same dark style as AdminBarChart.
 */

const GRID_STROKE = adminChartGridStroke;
const ACCENT = DEFAULT_COLORS[0];
const SECONDARY = DEFAULT_COLORS[3];
const SURFACE = adminChartSurfaceFill;

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
    <div className={clsx(adminPopover, "px-3 py-2 text-xs text-zinc-100")}>
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
            {typeof entry.value === "number"
              ? entry.value.toLocaleString("fr-FR")
              : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Donut de répartition par plateforme ───────────────────────────────────────

export interface PlatformSplit {
  name: string;
  /** Couleur de marque de la plateforme. */
  color: string;
  /** Part du budget quotidien, en pourcentage entier (ex. 50). */
  pct: number;
  /** Budget quotidien alloué en euros. */
  dailyEur: number;
}

export interface PlatformSplitDonutProps {
  splits: PlatformSplit[];
  totalDailyEur: number;
}

export function PlatformSplitDonut({
  splits,
  totalDailyEur,
}: PlatformSplitDonutProps) {
  const data = splits.map((s) => ({ name: s.name, value: s.dailyEur }));
  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row sm:gap-10">
      <div className="relative h-56 w-56 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={64}
              outerRadius={92}
              paddingAngle={2}
              stroke={SURFACE}
              strokeWidth={2}
            >
              {splits.map((s) => (
                <Cell key={s.name} fill={s.color} />
              ))}
            </Pie>
            <Tooltip content={<DarkTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold tracking-tight text-white tabular-nums text-white">
            {formatEur(totalDailyEur)}
          </span>
          <span className="text-xs/5 text-zinc-500 text-zinc-400">
            par jour
          </span>
        </div>
      </div>
      <ul className="w-full space-y-4">
        {splits.map((s) => (
          <li key={s.name} className="flex items-center gap-3">
            <span
              className="inline-block size-3 shrink-0 rounded-full ring-1 ring-admin-ring-strong"
              style={{ backgroundColor: s.color }}
              aria-hidden
            />
            <span className="min-w-0 flex-1 truncate text-sm/6 font-medium text-white">
              {s.name}
            </span>
            <span className="text-sm/6 tabular-nums text-zinc-500 text-zinc-400">
              {s.pct}%
            </span>
            <span className="w-28 text-right text-lg font-semibold tracking-tight tabular-nums text-white">
              {formatEur(s.dailyEur)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Projeté vs réel ───────────────────────────────────────────────────────────

export interface KpiComparisonPoint {
  metric: string;
  projete: number;
  reel: number;
}

export function KpiComparisonChart({ data }: { data: KpiComparisonPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={GRID_STROKE} vertical={false} />
        <XAxis
          dataKey="metric"
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={{ stroke: GRID_STROKE }}
        />
        <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={52} />
        <Tooltip
          content={<DarkTooltip />}
          cursor={{ fill: "rgba(255,255,255,0.04)" }}
        />
        <Legend
          wrapperStyle={{ fontSize: 12, color: "#a1a1aa" }}
          iconType="circle"
        />
        <Bar
          dataKey="projete"
          name="Projeté"
          fill={ACCENT}
          radius={[3, 3, 0, 0]}
          maxBarSize={48}
        />
        <Bar
          dataKey="reel"
          name="Réel"
          fill={SECONDARY}
          radius={[3, 3, 0, 0]}
          maxBarSize={48}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
