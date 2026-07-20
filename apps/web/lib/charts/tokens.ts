/**
 * Shared recharts styling constants for the admin dashboard.
 *
 * Recharts needs literal color strings for most SVG fill/stroke props (CSS
 * custom properties don't always resolve inside its internals), so these are
 * hardcoded hex/rgba values rather than `var(--admin-*)` tokens — kept in
 * sync by hand with the Deep Black admin palette in `app/globals.css`.
 *
 * Previously this palette was declared separately (and had drifted) in
 * AdminBarChart.tsx, AdminTrendChart.tsx, AdminSparkline.tsx, and the store
 * campaign page's CampaignCharts.tsx / page.tsx. This module is the single
 * source of truth — import from here instead of redeclaring.
 */

/**
 * Default series palette, lisible sur une surface zinc-900 sombre.
 *
 * SECONDARY (index 1, `#38bdf8` sky) reconciles a drift: AdminBarChart and
 * AdminTrendChart both used `#38bdf8`, and CampaignCharts' local `SECONDARY`
 * also used `#38bdf8` — three usages agree. AdminSparkline's unrelated
 * `stopColorMap` (rose/amber/zinc, keyed by named color prop, not a
 * DEFAULT_COLORS index) is a different, intentionally multi-color API and is
 * left untouched.
 */
export const DEFAULT_COLORS = ["#6366f1", "#10b981", "#f59e0b", "#38bdf8"];

/** Recharts axis tick label style, dark-surface admin theme. */
export const AXIS_TICK = { fill: "#a1a1aa", fontSize: 12 };

/** Cartesian grid line stroke, dark-surface admin theme. */
export const GRID_STROKE = "rgba(255,255,255,0.08)";

/**
 * SVG gradient stop colors for AdminSparkline, keyed by its named `color`
 * prop. Shares hex values with `DEFAULT_COLORS` where the named color
 * overlaps (indigo/emerald/amber); rose and zinc are sparkline-only.
 */
export const SPARKLINE_STOP_COLORS = {
  indigo: "#6366f1",
  emerald: "#10b981",
  rose: "#f43f5e",
  amber: "#f59e0b",
  zinc: "#71717a",
};
