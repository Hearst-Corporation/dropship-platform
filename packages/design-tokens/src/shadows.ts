/**
 * SHADOW TOKENS
 * Multi-layer elevation system.
 * Each level composites multiple box-shadow layers for depth realism.
 *
 * Philosophy: shadows have two components —
 *   1. Key light (directional, sharp) — top offset
 *   2. Ambient occlusion (soft, large spread) — diffuse depth
 */

// ─── LIGHT MODE SHADOWS ───────────────────────────────────────────────────────

export const shadowsLight = {
  none: "none",

  // Inset shadows — input wells, pressed states
  "inset-xs": "inset 0 1px 2px rgba(0 0 0 / 0.06)",
  "inset-sm": "inset 0 2px 4px rgba(0 0 0 / 0.08), inset 0 1px 2px rgba(0 0 0 / 0.04)",
  "inset-md": "inset 0 2px 8px rgba(0 0 0 / 0.10), inset 0 1px 3px rgba(0 0 0 / 0.06)",

  // Elevation shadows
  xs: "0 1px 2px rgba(0 0 0 / 0.05)",
  sm: "0 1px 2px rgba(0 0 0 / 0.05), 0 1px 3px rgba(0 0 0 / 0.08)",
  md: "0 2px 4px rgba(0 0 0 / 0.04), 0 4px 8px rgba(0 0 0 / 0.06), 0 1px 2px rgba(0 0 0 / 0.03)",
  lg: "0 4px 6px rgba(0 0 0 / 0.04), 0 8px 16px rgba(0 0 0 / 0.06), 0 2px 4px rgba(0 0 0 / 0.03)",
  xl: "0 8px 12px rgba(0 0 0 / 0.04), 0 16px 32px rgba(0 0 0 / 0.07), 0 4px 8px rgba(0 0 0 / 0.03)",
  "2xl": "0 12px 20px rgba(0 0 0 / 0.05), 0 24px 48px rgba(0 0 0 / 0.08), 0 6px 12px rgba(0 0 0 / 0.03)",

  // Floating — modals, command palettes, dropdowns
  floating: "0 4px 6px rgba(0 0 0 / 0.04), 0 12px 24px rgba(0 0 0 / 0.08), 0 20px 40px rgba(0 0 0 / 0.06)",

  // Overlay — full-page modals
  overlay: "0 8px 16px rgba(0 0 0 / 0.06), 0 32px 64px rgba(0 0 0 / 0.10), 0 64px 128px rgba(0 0 0 / 0.05)",

  // Focus rings — always brand-colored, defined via CSS vars
  "focus-ring":       "0 0 0 2px var(--color-bg-canvas), 0 0 0 4px var(--color-border-focus)",
  "focus-ring-error": "0 0 0 2px var(--color-bg-canvas), 0 0 0 4px var(--color-border-error)",
  "focus-ring-inner": "0 0 0 2px var(--color-border-focus)",

  // Brand glow — primary colored glow for premium CTAs
  "glow-brand": "0 0 0 1px rgba(var(--color-primary-500) / 0.15), 0 4px 16px rgba(var(--color-primary-500) / 0.15), 0 8px 32px rgba(var(--color-primary-500) / 0.10)",
  "glow-success": "0 4px 16px rgba(var(--color-emerald-500) / 0.20)",
  "glow-error":   "0 4px 16px rgba(var(--color-red-500) / 0.20)",

  // Glassmorphism — combined blur + shadow
  glass: "0 2px 4px rgba(0 0 0 / 0.04), 0 8px 24px rgba(0 0 0 / 0.06), inset 0 1px 0 rgba(255 255 255 / 0.60)",
  "glass-lg": "0 4px 8px rgba(0 0 0 / 0.06), 0 16px 48px rgba(0 0 0 / 0.08), inset 0 1px 0 rgba(255 255 255 / 0.70)",

  // Soft / neumorphic
  "neu-raised": "6px 6px 12px rgba(0 0 0 / 0.08), -6px -6px 12px rgba(255 255 255 / 0.80)",
  "neu-pressed": "inset 3px 3px 6px rgba(0 0 0 / 0.08), inset -3px -3px 6px rgba(255 255 255 / 0.70)",
} as const;

// ─── DARK MODE SHADOWS ────────────────────────────────────────────────────────
// Dark mode = reduce white highlights, increase black depth, add subtle colored glows

export const shadowsDark = {
  none: "none",

  "inset-xs": "inset 0 1px 2px rgba(0 0 0 / 0.25)",
  "inset-sm": "inset 0 2px 4px rgba(0 0 0 / 0.35), inset 0 1px 2px rgba(0 0 0 / 0.20)",
  "inset-md": "inset 0 2px 8px rgba(0 0 0 / 0.40), inset 0 1px 3px rgba(0 0 0 / 0.25)",

  xs: "0 1px 2px rgba(0 0 0 / 0.40)",
  sm: "0 1px 2px rgba(0 0 0 / 0.50), 0 1px 3px rgba(0 0 0 / 0.40), inset 0 1px 0 rgba(255 255 255 / 0.05)",
  md: "0 2px 4px rgba(0 0 0 / 0.30), 0 4px 8px rgba(0 0 0 / 0.40), 0 1px 2px rgba(0 0 0 / 0.25), inset 0 1px 0 rgba(255 255 255 / 0.04)",
  lg: "0 4px 6px rgba(0 0 0 / 0.35), 0 8px 16px rgba(0 0 0 / 0.45), 0 2px 4px rgba(0 0 0 / 0.30), inset 0 1px 0 rgba(255 255 255 / 0.04)",
  xl: "0 8px 12px rgba(0 0 0 / 0.40), 0 16px 32px rgba(0 0 0 / 0.50), 0 4px 8px rgba(0 0 0 / 0.35), inset 0 1px 0 rgba(255 255 255 / 0.05)",
  "2xl": "0 12px 20px rgba(0 0 0 / 0.45), 0 24px 48px rgba(0 0 0 / 0.55), 0 6px 12px rgba(0 0 0 / 0.40)",

  floating: "0 4px 6px rgba(0 0 0 / 0.40), 0 12px 24px rgba(0 0 0 / 0.55), 0 20px 40px rgba(0 0 0 / 0.40), inset 0 1px 0 rgba(255 255 255 / 0.06)",
  overlay:  "0 8px 16px rgba(0 0 0 / 0.50), 0 32px 64px rgba(0 0 0 / 0.65), 0 64px 128px rgba(0 0 0 / 0.45)",

  "focus-ring":       "0 0 0 2px var(--color-bg-canvas), 0 0 0 4px var(--color-border-focus)",
  "focus-ring-error": "0 0 0 2px var(--color-bg-canvas), 0 0 0 4px var(--color-border-error)",
  "focus-ring-inner": "0 0 0 2px var(--color-border-focus)",

  "glow-brand":   "0 0 0 1px rgba(99 102 241 / 0.20), 0 4px 16px rgba(99 102 241 / 0.25), 0 8px 32px rgba(99 102 241 / 0.15)",
  "glow-success": "0 4px 16px rgba(52 211 153 / 0.25)",
  "glow-error":   "0 4px 16px rgba(248 113 113 / 0.25)",

  glass:    "0 2px 4px rgba(0 0 0 / 0.30), 0 8px 24px rgba(0 0 0 / 0.40), inset 0 1px 0 rgba(255 255 255 / 0.06)",
  "glass-lg":"0 4px 8px rgba(0 0 0 / 0.40), 0 16px 48px rgba(0 0 0 / 0.55), inset 0 1px 0 rgba(255 255 255 / 0.07)",

  "neu-raised":  "6px 6px 12px rgba(0 0 0 / 0.40), -6px -6px 12px rgba(255 255 255 / 0.04)",
  "neu-pressed": "inset 3px 3px 6px rgba(0 0 0 / 0.45), inset -3px -3px 6px rgba(255 255 255 / 0.03)",
} as const;

// ─── LUXURY SHADOWS ────────────────────────────────────────────────────────────
// Gold-tinted for luxury-black theme

export const shadowsLuxury = {
  ...shadowsDark,
  "glow-brand": "0 0 0 1px rgba(212 175 55 / 0.20), 0 4px 16px rgba(212 175 55 / 0.20), 0 8px 32px rgba(212 175 55 / 0.10)",
  glass:    "0 2px 4px rgba(0 0 0 / 0.50), 0 8px 24px rgba(0 0 0 / 0.60), inset 0 1px 0 rgba(212 175 55 / 0.10)",
  "glass-lg":"0 4px 8px rgba(0 0 0 / 0.60), 0 16px 48px rgba(0 0 0 / 0.70), inset 0 1px 0 rgba(212 175 55 / 0.12)",
} as const;

export type ShadowScale = keyof typeof shadowsLight;
