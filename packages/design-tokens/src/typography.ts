/**
 * TYPOGRAPHY TOKENS
 * Full fluid type system using clamp() for viewport-adaptive scaling.
 * All sizes respond smoothly from 320px → 1920px viewport width.
 *
 * Naming: [role]-[size]
 * Roles: display, heading, body, label, mono, overline, caption
 */

// ─── FONT FAMILIES ────────────────────────────────────────────────────────────

export const fontFamily = {
  // Primary UI sans — Inter-style optical sizing
  sans: `"Inter var", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif`,

  // Display — premium editorial weight contrast
  display: `"Cal Sans", "DM Sans", "Inter var", system-ui, sans-serif`,

  // Monospace — code, terminal, data
  mono: `"JetBrains Mono", "Fira Code", "Cascadia Code", "SF Mono", "Consolas", monospace`,

  // Serif — editorial, luxury, hospitality
  serif: `"Libre Baskerville", "Georgia", "Times New Roman", serif`,
} as const;

// ─── FONT WEIGHTS ─────────────────────────────────────────────────────────────

export const fontWeight = {
  light:    "300",
  regular:  "400",
  medium:   "500",
  semibold: "600",
  bold:     "700",
  extrabold:"800",
  black:    "900",
} as const;

// ─── LINE HEIGHTS ─────────────────────────────────────────────────────────────

export const lineHeight = {
  none:    "1",
  tight:   "1.15",
  snug:    "1.25",
  normal:  "1.5",
  relaxed: "1.625",
  loose:   "2",
  // Named scale for roles
  display: "1.08",
  heading: "1.20",
  body:    "1.55",
  caption: "1.40",
  code:    "1.70",
} as const;

// ─── LETTER SPACING ───────────────────────────────────────────────────────────

export const letterSpacing = {
  tighter: "-0.05em",
  tight:   "-0.025em",
  normal:  "0em",
  wide:    "0.025em",
  wider:   "0.05em",
  widest:  "0.1em",
  // Named scale for roles
  display:  "-0.03em",
  heading:  "-0.02em",
  body:     "0em",
  label:    "0.01em",
  overline: "0.08em",
  mono:     "0em",
} as const;

// ─── FLUID TYPE SCALE ─────────────────────────────────────────────────────────
//
// Using clamp(min, preferred, max) for smooth fluid scaling.
// Formula: clamp(MIN_REM, VMIN + VW * SLOPE, MAX_REM)
//
// Viewport range: 320px (20rem) → 1920px (120rem)
// Each step is optically balanced, not mathematically rigid.

export const fontSize = {
  // ── Display — hero, marketing, landing ────────────────────────────────────
  "display-2xl": "clamp(3.5rem, 2rem + 5vw, 7.5rem)",     // 56px → 120px
  "display-xl":  "clamp(2.75rem, 1.75rem + 3.5vw, 6rem)", // 44px → 96px
  "display-lg":  "clamp(2.25rem, 1.5rem + 2.5vw, 4.5rem)",// 36px → 72px
  "display-md":  "clamp(1.875rem, 1.25rem + 2vw, 3.5rem)",// 30px → 56px
  "display-sm":  "clamp(1.5rem, 1.125rem + 1.5vw, 2.75rem)",// 24px → 44px

  // ── Heading — section titles, UI headers ──────────────────────────────────
  "heading-2xl": "clamp(1.875rem, 1.25rem + 2vw, 3rem)",  // 30px → 48px
  "heading-xl":  "clamp(1.5rem, 1rem + 1.5vw, 2.25rem)",  // 24px → 36px
  "heading-lg":  "clamp(1.25rem, 0.875rem + 1.25vw, 1.875rem)", // 20px → 30px
  "heading-md":  "clamp(1.125rem, 0.875rem + 0.75vw, 1.5rem)", // 18px → 24px
  "heading-sm":  "clamp(1rem, 0.875rem + 0.5vw, 1.25rem)",     // 16px → 20px
  "heading-xs":  "clamp(0.875rem, 0.8rem + 0.375vw, 1.125rem)",// 14px → 18px

  // ── Body — content, UI text ────────────────────────────────────────────────
  "body-xl":   "clamp(1.125rem, 1rem + 0.5vw, 1.375rem)", // 18px → 22px
  "body-lg":   "clamp(1rem, 0.875rem + 0.375vw, 1.125rem)", // 16px → 18px
  "body-md":   "1rem",                                       // 16px — fixed base
  "body-sm":   "0.875rem",                                   // 14px — fixed
  "body-xs":   "0.8125rem",                                  // 13px

  // ── Label / UI chrome ──────────────────────────────────────────────────────
  "label-lg":  "0.9375rem",  // 15px
  "label-md":  "0.875rem",   // 14px
  "label-sm":  "0.8125rem",  // 13px
  "label-xs":  "0.75rem",    // 12px

  // ── Overline / eyebrow ─────────────────────────────────────────────────────
  "overline-lg": "0.8125rem", // 13px — uppercase, widest tracking
  "overline-md": "0.75rem",   // 12px
  "overline-sm": "0.6875rem", // 11px

  // ── Caption / footnote ──────────────────────────────────────────────────────
  "caption-lg": "0.8125rem",  // 13px
  "caption-md": "0.75rem",    // 12px
  "caption-sm": "0.6875rem",  // 11px

  // ── Mono / code ────────────────────────────────────────────────────────────
  "mono-lg":   "1rem",       // 16px
  "mono-md":   "0.875rem",   // 14px
  "mono-sm":   "0.8125rem",  // 13px
  "mono-xs":   "0.75rem",    // 12px
} as const;

// ─── OPTICAL SIZING ───────────────────────────────────────────────────────────
// font-optical-sizing: auto enables intelligent glyph adjustments in variable fonts

export const opticalSizing = {
  auto: "auto",
  none: "none",
} as const;

// ─── COMPLETE TEXT STYLE PRESETS ──────────────────────────────────────────────
// Atomic presets for commonly reused text combinations

export const textStyles = {
  "display-2xl": {
    fontSize:      fontSize["display-2xl"],
    fontWeight:    fontWeight.extrabold,
    lineHeight:    lineHeight.display,
    letterSpacing: letterSpacing.display,
    fontFamily:    fontFamily.display,
  },
  "display-xl": {
    fontSize:      fontSize["display-xl"],
    fontWeight:    fontWeight.bold,
    lineHeight:    lineHeight.display,
    letterSpacing: letterSpacing.display,
    fontFamily:    fontFamily.display,
  },
  "display-lg": {
    fontSize:      fontSize["display-lg"],
    fontWeight:    fontWeight.bold,
    lineHeight:    lineHeight.display,
    letterSpacing: letterSpacing.display,
    fontFamily:    fontFamily.display,
  },
  "heading-xl": {
    fontSize:      fontSize["heading-xl"],
    fontWeight:    fontWeight.bold,
    lineHeight:    lineHeight.heading,
    letterSpacing: letterSpacing.heading,
    fontFamily:    fontFamily.sans,
  },
  "heading-lg": {
    fontSize:      fontSize["heading-lg"],
    fontWeight:    fontWeight.semibold,
    lineHeight:    lineHeight.heading,
    letterSpacing: letterSpacing.heading,
    fontFamily:    fontFamily.sans,
  },
  "heading-md": {
    fontSize:      fontSize["heading-md"],
    fontWeight:    fontWeight.semibold,
    lineHeight:    lineHeight.heading,
    letterSpacing: letterSpacing.heading,
    fontFamily:    fontFamily.sans,
  },
  "heading-sm": {
    fontSize:      fontSize["heading-sm"],
    fontWeight:    fontWeight.medium,
    lineHeight:    lineHeight.heading,
    letterSpacing: letterSpacing.heading,
    fontFamily:    fontFamily.sans,
  },
  "body-lg": {
    fontSize:   fontSize["body-lg"],
    fontWeight: fontWeight.regular,
    lineHeight: lineHeight.body,
    fontFamily: fontFamily.sans,
  },
  "body-md": {
    fontSize:   fontSize["body-md"],
    fontWeight: fontWeight.regular,
    lineHeight: lineHeight.body,
    fontFamily: fontFamily.sans,
  },
  "body-sm": {
    fontSize:   fontSize["body-sm"],
    fontWeight: fontWeight.regular,
    lineHeight: lineHeight.body,
    fontFamily: fontFamily.sans,
  },
  "label-md": {
    fontSize:      fontSize["label-md"],
    fontWeight:    fontWeight.medium,
    lineHeight:    lineHeight.caption,
    letterSpacing: letterSpacing.label,
    fontFamily:    fontFamily.sans,
  },
  "label-sm": {
    fontSize:      fontSize["label-sm"],
    fontWeight:    fontWeight.medium,
    lineHeight:    lineHeight.caption,
    letterSpacing: letterSpacing.label,
    fontFamily:    fontFamily.sans,
  },
  overline: {
    fontSize:      fontSize["overline-md"],
    fontWeight:    fontWeight.semibold,
    lineHeight:    lineHeight.caption,
    letterSpacing: letterSpacing.overline,
    textTransform: "uppercase" as const,
    fontFamily:    fontFamily.sans,
  },
  caption: {
    fontSize:   fontSize["caption-md"],
    fontWeight: fontWeight.regular,
    lineHeight: lineHeight.caption,
    fontFamily: fontFamily.sans,
  },
  "mono-md": {
    fontSize:      fontSize["mono-md"],
    fontWeight:    fontWeight.regular,
    lineHeight:    lineHeight.code,
    letterSpacing: letterSpacing.mono,
    fontFamily:    fontFamily.mono,
  },
} as const;

export type FontSize    = keyof typeof fontSize;
export type TextStyle   = keyof typeof textStyles;
export type FontFamily  = keyof typeof fontFamily;
export type FontWeight  = keyof typeof fontWeight;
