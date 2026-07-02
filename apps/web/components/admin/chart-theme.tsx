"use client";

/**
 * Thème partagé des charts admin (recharts). Source unique pour la palette,
 * les ticks d'axes, la grille, le tooltip et l'état vide — importé par
 * AdminTrendChart, AdminBarChart et AdminFunnelChart pour que le thème ne
 * puisse pas diverger entre les trois.
 *
 * Politique mono-accent: la seule teinte autorisée est l'accent indigo; les
 * séries secondaires descendent en zinc. Aucun emerald/amber/sky.
 */

/** Rampe de séries: indigo pour la principale, zinc pour les secondaires. */
export const CHART_COLORS = [
  "#6366f1", // indigo-500 — série principale
  "#a1a1aa", // zinc-400 — série secondaire
  "#818cf8", // indigo-400
  "#52525b", // zinc-600
];

/** Rampe funnel: 100% indigo, par luminosité décroissante d'étape en étape. */
export const FUNNEL_COLORS = [
  "#4f46e5", // indigo-600
  "#6366f1", // indigo-500
  "#818cf8", // indigo-400
  "#a5b4fc", // indigo-300
  "#c7d2fe", // indigo-200
];

export const AXIS_TICK = { fill: "#a1a1aa", fontSize: 12 };
export const GRID_STROKE = "rgba(255,255,255,0.08)";
export const LEGEND_STYLE = { fontSize: 12, color: "#a1a1aa" };

export interface ChartTooltipEntry {
  name?: string;
  value?: number | string;
  color?: string;
}

/** Tooltip sombre partagé, cohérent avec les surfaces AdminSection. */
export function ChartTooltip({
  active,
  payload,
  label,
  formatter,
}: {
  active?: boolean;
  payload?: ChartTooltipEntry[];
  label?: string | number;
  /** Formatte la valeur affichée (ex. ajouter une unité). */
  formatter?: (value: number | string, name?: string) => string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs text-white shadow-lg">
      {label !== undefined && (
        <div className="mb-1 font-medium text-zinc-500 text-zinc-400">
          {label}
        </div>
      )}
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2">
          <span
            className="inline-block size-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-zinc-500 text-zinc-400">{entry.name}</span>
          <span className="ml-auto pl-4 font-medium tabular-nums">
            {formatter && entry.value !== undefined
              ? formatter(entry.value, entry.name)
              : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}

/** État vide partagé des charts, aligné sur les tokens AdminSection. */
export function ChartEmptyState({ height }: { height: number }) {
  return (
    <div
      className="flex items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-sm text-zinc-400"
      style={{ height }}
    >
      Pas encore de données
    </div>
  );
}
