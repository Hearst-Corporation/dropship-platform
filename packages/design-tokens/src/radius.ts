/**
 * BORDER RADIUS TOKENS
 * Named semantic scale + component-specific overrides.
 * Supports per-brand radius personality via CSS variables.
 */

export const radius = {
  none:   "0px",
  xs:     "0.125rem",  //  2px — chips, hairline
  sm:     "0.25rem",   //  4px — subtle
  md:     "0.375rem",  //  6px — standard
  lg:     "0.5rem",    //  8px — cards, inputs
  xl:     "0.75rem",   // 12px — panels, modals
  "2xl":  "1rem",      // 16px — large modals
  "3xl":  "1.25rem",   // 20px — floating panels
  "4xl":  "1.5rem",    // 24px — premium cards
  full:   "9999px",    // pill — badges, tags, toggles
} as const;

// ─── COMPONENT RADIUS MAP ─────────────────────────────────────────────────────
// Per-component overrides — can be swapped by theme/brand

export const componentRadius = {
  button:     "var(--radius-md)",     // 6px default
  "button-lg":"var(--radius-lg)",     // 8px for large buttons
  "button-pill":"var(--radius-full)", // pill style
  input:      "var(--radius-lg)",     // 8px
  card:       "var(--radius-xl)",     // 12px
  "card-lg":  "var(--radius-2xl)",    // 16px
  modal:      "var(--radius-2xl)",    // 16px
  drawer:     "var(--radius-2xl)",    // 16px top corners
  popover:    "var(--radius-xl)",     // 12px
  tooltip:    "var(--radius-md)",     // 6px
  badge:      "var(--radius-full)",   // pill
  "badge-sm": "var(--radius-sm)",     // 4px square badges
  avatar:     "var(--radius-full)",   // circle
  "avatar-sq":"var(--radius-lg)",     // square avatar
  tag:        "var(--radius-md)",     // 6px
  checkbox:   "var(--radius-sm)",     // 4px
  toggle:     "var(--radius-full)",   // pill
  menu:       "var(--radius-xl)",     // 12px
  table:      "var(--radius-lg)",     // 8px
  "table-cell":"var(--radius-none)",  // flat cells
  code:       "var(--radius-md)",     // 6px
  image:      "var(--radius-xl)",     // 12px
  "image-lg": "var(--radius-2xl)",    // 16px
  notification:"var(--radius-xl)",    // 12px
  dock:       "var(--radius-2xl)",    // 16px
  chart:      "var(--radius-md)",     // 6px
} as const;

export type Radius = keyof typeof radius;
export type ComponentRadius = keyof typeof componentRadius;
