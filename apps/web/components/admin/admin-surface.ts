/**
 * Admin surface design system — single source of truth for box backgrounds,
 * borders, rings, and skeleton washes (Deep Black palette).
 *
 * Color values live in `app/globals.css` under `.dark` as `--admin-surface-*`
 * and `--admin-border-*` / `--admin-ring-*`. This file only references those
 * Tailwind theme tokens — no hardcoded hex or white/opacity literals here.
 *
 * Policy:
 *   - Page chrome (Catalyst shell) stays on zinc-950; boxes are pure deep black.
 *   - Every admin panel/inset/well imports from this module.
 *   - Loading skeletons use `adminSkeleton` / `adminSkeletonStrong`.
 */

// ── Backgrounds ─────────────────────────────────────────────────────────────

/** Primary card / panel / section surface (#000). */
export const adminBgPanel = "bg-admin-surface-panel";

/** Inset wells: tables, code blocks, nested form areas. */
export const adminBgInset = "bg-admin-surface-inset";

/** Header rows and lightly raised strips inside a panel. */
export const adminBgHighlight = "bg-admin-surface-highlight";

/** Hover / interactive lift on inset rows. */
export const adminBgRaised = "bg-admin-surface-raised";

/** Skeleton shimmer blocks (loading.tsx). */
export const adminSkeleton = "bg-admin-surface-skeleton";

/** Stronger skeleton / placeholder blocks. */
export const adminSkeletonStrong = "bg-admin-surface-muted";

/** Progress / timeline track. */
export const adminBgTrack = "bg-admin-surface-track";

/** Status dot (inactive). */
export const adminBgDot = "bg-admin-surface-dot";

/** KPI strip cell background (indigo accent). */
export const adminBgKpi = "bg-admin-surface-kpi";

// ── KPI strip (side-by-side metrics rows) ───────────────────────────────────

export const adminBorderKpi = "border-admin-border-kpi";
export const adminKpiDivider = "divide-admin-kpi-divider";

/** Outer grid wrapping AdminStatCard cells (dépenses, revenus, conversion…). */
export const adminKpiStrip =
  `grid grid-cols-1 overflow-hidden rounded-xl border ${adminBorderKpi} ${adminBgKpi} divide-y ${adminKpiDivider} sm:divide-y-0 sm:divide-x`;

/** Typography on indigo KPI surfaces. */
export const adminTextOnKpi = "text-admin-on-kpi";
export const adminTextOnKpiMuted = "text-admin-on-kpi-muted";
export const adminTextOnKpiFaint = "text-admin-on-kpi-faint";

/** KPI loading skeleton shimmer on the strip. */
export const adminKpiSkeleton = "bg-admin-on-kpi/15";

// ── Borders & rings ─────────────────────────────────────────────────────────

export const adminBorder = "border-admin-border";
export const adminBorderStrong = "border-admin-border-strong";
export const adminBorderSoft = "border-admin-border-soft";
export const adminBorderDashed = "border-dashed border-admin-border-soft";

export const adminRing = "ring-1 ring-admin-ring";
export const adminRingStrong = "ring-1 ring-admin-ring-strong";
export const adminRingHover = "hover:ring-admin-ring-hover";

export const adminDivider = adminBorder;
export const adminSectionDivider = `border-t ${adminBorder}`;

// ── Composed surfaces (prefer these in pages) ───────────────────────────────

/** Standard bordered panel. */
export const adminPanel = `border ${adminBorder} ${adminBgPanel}`;

/** Bordered panel with inset fill (KPI sub-cards, form wells). */
export const adminPanelInset = `border ${adminBorder} ${adminBgInset}`;

/** Bordered panel with highlight fill (section headers, hero strips). */
export const adminPanelHighlight = `border ${adminBorder} ${adminBgHighlight}`;

/** Ring-only panel (no border). */
export const adminRingPanel = `${adminRing} ${adminBgPanel}`;

export const adminRingInset = `${adminRing} ${adminBgInset}`;

/** Section header row inside a panel. */
export const adminSectionHeader = `border-b ${adminBorder} ${adminBgHighlight}`;

/** Highlight wash overlay inside an existing panel. */
export const adminHighlightWash = adminBgHighlight;

/** Inset surface without border. */
export const adminInset = adminBgInset;

export const adminInsetHover = "hover:bg-admin-surface-raised";

/** Chart / tooltip popover on dark surfaces. */
export const adminPopover = `rounded border ${adminBorder} ${adminBgInset} shadow-lg`;

/** Chart empty-state placeholder box. */
export const adminChartPlaceholder = `flex items-center justify-center rounded-lg border ${adminBorder} ${adminBgInset}`;

/** Template preview sticky chrome (semi-opaque bar over storefront). */
export const adminPreviewChrome =
  "border-b border-admin-border-strong bg-admin-preview-chrome backdrop-blur-sm";

/**
 * Corner label sitting on top of an arbitrary storefront screenshot. Opaque
 * tint rather than a backdrop-filter: the thumbnail underneath is opaque, so a
 * blur layer would cost a compositing layer per card for no visible effect.
 */
export const adminPreviewBadge =
  "bg-black/60 text-white/85";

/** Flat accent hairline (unused — kept for API stability). */
export const adminAccentTop = "";

// ── Typography on dark surfaces ─────────────────────────────────────────────

export const adminTextMuted = "text-zinc-400";
export const adminText = "text-zinc-100";

// ── Chart / canvas (recharts stroke — not Tailwind) ─────────────────────────

/** Grid line stroke for recharts on deep black surfaces. */
export const adminChartGridStroke = "var(--admin-border-default)";

/** Recharts pie segment outline on deep black surfaces. */
export const adminChartSurfaceFill = "var(--admin-surface-panel)";
