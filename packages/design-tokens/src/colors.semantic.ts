/**
 * SEMANTIC COLOR TOKENS
 * Maps primitive scales → intent-based names.
 * Components ONLY reference semantic tokens — never primitives.
 *
 * Each theme overrides this map via CSS custom properties.
 * Structure: category.role.variant
 */

// ─── TYPE CONTRACTS ──────────────────────────────────────────────────────────

export interface SemanticColorTheme {
  // Backgrounds
  bg: {
    canvas: string;        // page-level background
    primary: string;       // primary surface (cards, panels)
    secondary: string;     // secondary surface (sidebars, elevated)
    tertiary: string;      // tertiary surface (code blocks, inputs)
    inverse: string;       // flipped bg for contrast elements
    overlay: string;       // modal scrims, drawers
    glass: string;         // glassmorphism surfaces
    glassStrong: string;   // glassmorphism — higher opacity
  };

  // Text
  text: {
    primary: string;       // body text
    secondary: string;     // subdued / supporting text
    tertiary: string;      // placeholder, disabled labels
    quaternary: string;    // extra subdued hints
    inverse: string;       // text on dark fills
    link: string;          // hyperlinks
    linkHover: string;
    brand: string;         // brand-colored text
    success: string;
    warning: string;
    error: string;
    info: string;
    onBrand: string;       // text on brand-colored fills
    onDanger: string;
  };

  // Borders
  border: {
    subtle: string;        // hairline separators
    default: string;       // standard borders
    strong: string;        // emphasis borders
    brand: string;         // brand-accent borders
    focus: string;         // keyboard focus rings
    error: string;
    success: string;
  };

  // Brand fills (buttons, badges, accents)
  brand: {
    primary: string;
    primaryHover: string;
    primaryActive: string;
    primarySubtle: string;
    primarySubtleHover: string;
    secondary: string;
    secondaryHover: string;
  };

  // Status fills
  status: {
    successFill: string;
    successSubtle: string;
    successText: string;
    warningFill: string;
    warningSubtle: string;
    warningText: string;
    errorFill: string;
    errorSubtle: string;
    errorText: string;
    infoFill: string;
    infoSubtle: string;
    infoText: string;
    neutralFill: string;
    neutralSubtle: string;
  };

  // Interactive states
  interactive: {
    hover: string;         // generic hover overlay
    pressed: string;       // generic pressed overlay
    selected: string;      // selected row / item
    focus: string;         // focus ring color
    disabled: string;      // disabled overlay
    placeholder: string;   // input placeholders
  };

  // Data viz (8-step accessible palette)
  chart: {
    1: string;
    2: string;
    3: string;
    4: string;
    5: string;
    6: string;
    7: string;
    8: string;
    gridLine: string;
    axisLabel: string;
    tooltip: string;
  };

  // Glassmorphism
  glass: {
    border: string;
    shadow: string;
    highlight: string;
    blur: string;          // backdrop-filter value, not a color — kept here for theme grouping
  };
}

// ─── LIGHT THEME ─────────────────────────────────────────────────────────────

export const lightTheme: SemanticColorTheme = {
  bg: {
    canvas:      "var(--color-neutral-25)",
    primary:     "var(--color-neutral-0)",
    secondary:   "var(--color-neutral-50)",
    tertiary:    "var(--color-neutral-100)",
    inverse:     "var(--color-neutral-900)",
    overlay:     "rgba(var(--color-black-32))",
    glass:       "rgba(255 255 255 / 0.72)",
    glassStrong: "rgba(255 255 255 / 0.90)",
  },
  text: {
    primary:     "var(--color-neutral-900)",
    secondary:   "var(--color-neutral-600)",
    tertiary:    "var(--color-neutral-400)",
    quaternary:  "var(--color-neutral-300)",
    inverse:     "var(--color-neutral-0)",
    link:        "var(--color-primary-600)",
    linkHover:   "var(--color-primary-700)",
    brand:       "var(--color-primary-600)",
    success:     "var(--color-emerald-700)",
    warning:     "var(--color-amber-700)",
    error:       "var(--color-red-600)",
    info:        "var(--color-primary-700)",
    onBrand:     "var(--color-neutral-0)",
    onDanger:    "var(--color-neutral-0)",
  },
  border: {
    subtle:  "var(--color-neutral-100)",
    default: "var(--color-neutral-200)",
    strong:  "var(--color-neutral-300)",
    brand:   "var(--color-primary-500)",
    focus:   "var(--color-primary-500)",
    error:   "var(--color-red-500)",
    success: "var(--color-emerald-500)",
  },
  brand: {
    primary:           "var(--color-primary-500)",
    primaryHover:      "var(--color-primary-600)",
    primaryActive:     "var(--color-primary-700)",
    primarySubtle:     "var(--color-primary-50)",
    primarySubtleHover:"var(--color-primary-100)",
    secondary:         "var(--color-violet-500)",
    secondaryHover:    "var(--color-violet-600)",
  },
  status: {
    successFill:   "var(--color-emerald-500)",
    successSubtle: "var(--color-emerald-50)",
    successText:   "var(--color-emerald-700)",
    warningFill:   "var(--color-amber-500)",
    warningSubtle: "var(--color-amber-50)",
    warningText:   "var(--color-amber-700)",
    errorFill:     "var(--color-red-500)",
    errorSubtle:   "var(--color-red-50)",
    errorText:     "var(--color-red-600)",
    infoFill:      "var(--color-primary-500)",
    infoSubtle:    "var(--color-primary-50)",
    infoText:      "var(--color-primary-700)",
    neutralFill:   "var(--color-neutral-500)",
    neutralSubtle: "var(--color-neutral-100)",
  },
  interactive: {
    hover:       "rgba(var(--color-black-8))",
    pressed:     "rgba(var(--color-black-12))",
    selected:    "rgba(var(--color-primary-alpha-8))",
    focus:       "var(--color-primary-500)",
    disabled:    "rgba(var(--color-black-4))",
    placeholder: "var(--color-neutral-400)",
  },
  chart: {
    1: "var(--color-primary-500)",
    2: "var(--color-violet-500)",
    3: "var(--color-cyan-400)",
    4: "var(--color-emerald-500)",
    5: "var(--color-amber-500)",
    6: "var(--color-rose-500)",
    7: "var(--color-gold-500)",
    8: "var(--color-neutral-400)",
    gridLine:  "var(--color-neutral-100)",
    axisLabel: "var(--color-neutral-400)",
    tooltip:   "var(--color-neutral-0)",
  },
  glass: {
    border:    "rgba(255 255 255 / 0.18)",
    shadow:    "rgba(0 0 0 / 0.08)",
    highlight: "rgba(255 255 255 / 0.6)",
    blur:      "blur(20px) saturate(180%)",
  },
};

// ─── DARK THEME ───────────────────────────────────────────────────────────────

export const darkTheme: SemanticColorTheme = {
  bg: {
    canvas:      "var(--color-neutral-925)",
    primary:     "var(--color-neutral-900)",
    secondary:   "var(--color-neutral-850)",
    tertiary:    "var(--color-neutral-800)",
    inverse:     "var(--color-neutral-50)",
    overlay:     "rgba(var(--color-black-64))",
    glass:       "rgba(15 17 23 / 0.72)",
    glassStrong: "rgba(15 17 23 / 0.90)",
  },
  text: {
    primary:     "var(--color-neutral-50)",
    secondary:   "var(--color-neutral-300)",
    tertiary:    "var(--color-neutral-500)",
    quaternary:  "var(--color-neutral-600)",
    inverse:     "var(--color-neutral-900)",
    link:        "var(--color-primary-300)",
    linkHover:   "var(--color-primary-200)",
    brand:       "var(--color-primary-300)",
    success:     "var(--color-emerald-300)",
    warning:     "var(--color-amber-300)",
    error:       "var(--color-red-300)",
    info:        "var(--color-primary-300)",
    onBrand:     "var(--color-neutral-0)",
    onDanger:    "var(--color-neutral-0)",
  },
  border: {
    subtle:  "var(--color-neutral-850)",
    default: "var(--color-neutral-800)",
    strong:  "var(--color-neutral-700)",
    brand:   "var(--color-primary-500)",
    focus:   "var(--color-primary-400)",
    error:   "var(--color-red-400)",
    success: "var(--color-emerald-400)",
  },
  brand: {
    primary:           "var(--color-primary-500)",
    primaryHover:      "var(--color-primary-400)",
    primaryActive:     "var(--color-primary-300)",
    primarySubtle:     "rgba(var(--color-primary-alpha-8))",
    primarySubtleHover:"rgba(var(--color-primary-alpha-12))",
    secondary:         "var(--color-violet-400)",
    secondaryHover:    "var(--color-violet-300)",
  },
  status: {
    successFill:   "var(--color-emerald-500)",
    successSubtle: "rgba(var(--color-emerald-900))",
    successText:   "var(--color-emerald-300)",
    warningFill:   "var(--color-amber-500)",
    warningSubtle: "rgba(var(--color-amber-900))",
    warningText:   "var(--color-amber-300)",
    errorFill:     "var(--color-red-500)",
    errorSubtle:   "rgba(var(--color-red-900))",
    errorText:     "var(--color-red-300)",
    infoFill:      "var(--color-primary-500)",
    infoSubtle:    "rgba(var(--color-primary-alpha-8))",
    infoText:      "var(--color-primary-300)",
    neutralFill:   "var(--color-neutral-500)",
    neutralSubtle: "var(--color-neutral-850)",
  },
  interactive: {
    hover:       "rgba(var(--color-white-8))",
    pressed:     "rgba(var(--color-white-12))",
    selected:    "rgba(var(--color-primary-alpha-12))",
    focus:       "var(--color-primary-400)",
    disabled:    "rgba(var(--color-white-4))",
    placeholder: "var(--color-neutral-600)",
  },
  chart: {
    1: "var(--color-primary-400)",
    2: "var(--color-violet-400)",
    3: "var(--color-cyan-300)",
    4: "var(--color-emerald-400)",
    5: "var(--color-amber-400)",
    6: "var(--color-rose-400)",
    7: "var(--color-gold-400)",
    8: "var(--color-neutral-500)",
    gridLine:  "var(--color-neutral-800)",
    axisLabel: "var(--color-neutral-500)",
    tooltip:   "var(--color-neutral-850)",
  },
  glass: {
    border:    "rgba(255 255 255 / 0.08)",
    shadow:    "rgba(0 0 0 / 0.32)",
    highlight: "rgba(255 255 255 / 0.04)",
    blur:      "blur(20px) saturate(160%)",
  },
};

// ─── AMOLED THEME ────────────────────────────────────────────────────────────

export const amoledTheme: SemanticColorTheme = {
  ...darkTheme,
  bg: {
    canvas:      "0 0% 0%",
    primary:     "var(--color-neutral-975)",
    secondary:   "var(--color-neutral-950)",
    tertiary:    "var(--color-neutral-925)",
    inverse:     "var(--color-neutral-50)",
    overlay:     "rgba(0 0 0 / 0.80)",
    glass:       "rgba(0 0 0 / 0.80)",
    glassStrong: "rgba(0 0 0 / 0.95)",
  },
  border: {
    ...darkTheme.border,
    subtle:  "var(--color-neutral-950)",
    default: "var(--color-neutral-925)",
    strong:  "var(--color-neutral-850)",
  },
};

// ─── LUXURY BLACK THEME ───────────────────────────────────────────────────────

export const luxuryBlackTheme: SemanticColorTheme = {
  ...darkTheme,
  bg: {
    canvas:      "var(--color-neutral-1000)",
    primary:     "var(--color-neutral-975)",
    secondary:   "var(--color-neutral-950)",
    tertiary:    "var(--color-neutral-925)",
    inverse:     "var(--color-neutral-0)",
    overlay:     "rgba(0 0 0 / 0.85)",
    glass:       "rgba(5 5 5 / 0.85)",
    glassStrong: "rgba(5 5 5 / 0.96)",
  },
  text: {
    ...darkTheme.text,
    brand: "var(--color-gold-400)",
    link:  "var(--color-gold-300)",
    linkHover: "var(--color-gold-200)",
  },
  border: {
    ...darkTheme.border,
    subtle:  "rgba(255 255 255 / 0.06)",
    default: "rgba(255 255 255 / 0.10)",
    strong:  "rgba(255 255 255 / 0.16)",
    brand:   "var(--color-gold-500)",
    focus:   "var(--color-gold-400)",
  },
  brand: {
    primary:           "var(--color-gold-500)",
    primaryHover:      "var(--color-gold-400)",
    primaryActive:     "var(--color-gold-300)",
    primarySubtle:     "rgba(var(--color-gold-900))",
    primarySubtleHover:"rgba(var(--color-gold-800))",
    secondary:         "var(--color-neutral-400)",
    secondaryHover:    "var(--color-neutral-300)",
  },
  glass: {
    border:    "rgba(212 175 55 / 0.12)",
    shadow:    "rgba(0 0 0 / 0.60)",
    highlight: "rgba(212 175 55 / 0.04)",
    blur:      "blur(24px) saturate(140%)",
  },
};

// ─── GLASS THEME ──────────────────────────────────────────────────────────────

export const glassTheme: SemanticColorTheme = {
  ...lightTheme,
  bg: {
    canvas:      "linear-gradient(135deg, hsl(230 60% 96%) 0%, hsl(270 60% 96%) 100%)",
    primary:     "rgba(255 255 255 / 0.65)",
    secondary:   "rgba(255 255 255 / 0.45)",
    tertiary:    "rgba(255 255 255 / 0.30)",
    inverse:     "rgba(20 20 40 / 0.85)",
    overlay:     "rgba(0 0 0 / 0.20)",
    glass:       "rgba(255 255 255 / 0.65)",
    glassStrong: "rgba(255 255 255 / 0.85)",
  },
  border: {
    ...lightTheme.border,
    subtle:  "rgba(255 255 255 / 0.50)",
    default: "rgba(255 255 255 / 0.65)",
    strong:  "rgba(255 255 255 / 0.80)",
  },
  glass: {
    border:    "rgba(255 255 255 / 0.50)",
    shadow:    "rgba(31 38 135 / 0.15)",
    highlight: "rgba(255 255 255 / 0.70)",
    blur:      "blur(24px) saturate(200%)",
  },
};

// ─── ENTERPRISE THEME ─────────────────────────────────────────────────────────
// Muted, high-trust, corporate

export const enterpriseTheme: SemanticColorTheme = {
  ...lightTheme,
  bg: {
    ...lightTheme.bg,
    canvas:  "var(--color-neutral-50)",
    primary: "var(--color-neutral-0)",
  },
  text: {
    ...lightTheme.text,
    primary:   "var(--color-neutral-900)",
    secondary: "var(--color-neutral-600)",
    brand:     "var(--color-primary-700)",
    link:      "var(--color-primary-700)",
  },
  brand: {
    ...lightTheme.brand,
    primary:       "var(--color-primary-700)",
    primaryHover:  "var(--color-primary-800)",
    primaryActive: "var(--color-primary-900)",
    primarySubtle: "var(--color-primary-50)",
  },
};

// ─── NEON CYBERPUNK THEME ─────────────────────────────────────────────────────

export const neonCyberpunkTheme: SemanticColorTheme = {
  ...darkTheme,
  bg: {
    canvas:      "hsl(240 15% 4%)",
    primary:     "hsl(240 14% 7%)",
    secondary:   "hsl(240 13% 10%)",
    tertiary:    "hsl(240 12% 14%)",
    inverse:     "var(--color-neutral-50)",
    overlay:     "rgba(0 0 0 / 0.75)",
    glass:       "rgba(10 10 25 / 0.80)",
    glassStrong: "rgba(10 10 25 / 0.95)",
  },
  text: {
    ...darkTheme.text,
    brand:     "var(--color-neonGreen-400)",
    link:      "var(--color-neonBlue-400)",
    linkHover: "var(--color-neonBlue-500)",
  },
  border: {
    ...darkTheme.border,
    subtle:  "rgba(0 255 200 / 0.06)",
    default: "rgba(0 255 200 / 0.12)",
    strong:  "rgba(0 255 200 / 0.20)",
    brand:   "var(--color-neonGreen-400)",
    focus:   "var(--color-neonBlue-400)",
  },
  brand: {
    primary:           "var(--color-neonGreen-500)",
    primaryHover:      "var(--color-neonGreen-400)",
    primaryActive:     "var(--color-neonBlue-400)",
    primarySubtle:     "rgba(0 255 128 / 0.06)",
    primarySubtleHover:"rgba(0 255 128 / 0.12)",
    secondary:         "var(--color-neonBlue-500)",
    secondaryHover:    "var(--color-neonBlue-400)",
  },
  chart: {
    1: "var(--color-neonGreen-400)",
    2: "var(--color-neonBlue-400)",
    3: "var(--color-neonPurple-400)",
    4: "var(--color-neonPink-400)",
    5: "var(--color-cyan-300)",
    6: "var(--color-amber-400)",
    7: "var(--color-rose-400)",
    8: "var(--color-neutral-500)",
    gridLine:  "rgba(0 255 200 / 0.06)",
    axisLabel: "rgba(0 255 200 / 0.40)",
    tooltip:   "hsl(240 14% 7%)",
  },
  glass: {
    border:    "rgba(0 255 200 / 0.15)",
    shadow:    "rgba(0 255 128 / 0.20)",
    highlight: "rgba(0 255 200 / 0.04)",
    blur:      "blur(20px) saturate(180%)",
  },
};

// ─── MINIMAL MONOCHROME THEME ─────────────────────────────────────────────────

export const minimalMonochromeTheme: SemanticColorTheme = {
  ...lightTheme,
  brand: {
    primary:           "var(--color-neutral-900)",
    primaryHover:      "var(--color-neutral-800)",
    primaryActive:     "var(--color-neutral-700)",
    primarySubtle:     "var(--color-neutral-100)",
    primarySubtleHover:"var(--color-neutral-150)",
    secondary:         "var(--color-neutral-600)",
    secondaryHover:    "var(--color-neutral-500)",
  },
  border: {
    ...lightTheme.border,
    brand:  "var(--color-neutral-900)",
    focus:  "var(--color-neutral-900)",
  },
  text: {
    ...lightTheme.text,
    brand:    "var(--color-neutral-900)",
    link:     "var(--color-neutral-700)",
    linkHover:"var(--color-neutral-900)",
  },
};

// ─── THEME REGISTRY ───────────────────────────────────────────────────────────

export const themes = {
  light:             lightTheme,
  dark:              darkTheme,
  amoled:            amoledTheme,
  "luxury-black":    luxuryBlackTheme,
  glass:             glassTheme,
  enterprise:        enterpriseTheme,
  "neon-cyberpunk":  neonCyberpunkTheme,
  "minimal-mono":    minimalMonochromeTheme,
} as const;

export type ThemeName = keyof typeof themes;
