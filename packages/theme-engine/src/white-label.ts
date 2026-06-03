/**
 * WHITE-LABEL ENGINE
 * Multi-tenant brand injection.
 * Each tenant gets a unique CSS block scoped to [data-tenant="id"].
 *
 * Tenants can override:
 *   - Brand colors (primary, secondary, accent)
 *   - Typography (font family, scale modifier)
 *   - Border radius personality (sharp / rounded / pill)
 *   - Shadow density (minimal / standard / rich)
 *   - Motion intensity (none / subtle / full)
 *   - Spacing density (compact / normal / spacious)
 *   - Logo URL
 *   - Custom CSS (escape hatch)
 */

// ─── TENANT CONFIG SCHEMA ─────────────────────────────────────────────────────

export interface TenantColorConfig {
  /** HSL string e.g. "234 76% 50%" */
  primaryH: string;
  primaryS: string;
  primaryL: string;
  secondaryH?: string;
  secondaryS?: string;
  secondaryL?: string;
  accentH?: string;
  accentS?: string;
  accentL?: string;
}

export type RadiusPersonality = "sharp" | "subtle" | "rounded" | "pill";
export type ShadowDensity     = "flat" | "minimal" | "standard" | "rich";
export type MotionIntensity   = "none" | "reduced" | "subtle" | "full";
export type SpacingDensity    = "compact" | "normal" | "spacious";

export interface TenantBrandConfig {
  id: string;
  name: string;

  // Visual DNA
  colors?: TenantColorConfig;
  radius?: RadiusPersonality;
  shadows?: ShadowDensity;
  motion?: MotionIntensity;
  spacing?: SpacingDensity;

  // Typography
  fontSans?: string;
  fontDisplay?: string;
  fontMono?: string;

  // Assets
  logo?: string;
  logoMark?: string;
  favicon?: string;

  // Custom overrides (raw CSS vars)
  customVars?: Record<string, string>;
}

// ─── RADIUS MAPS ──────────────────────────────────────────────────────────────

const radiusMaps: Record<RadiusPersonality, Record<string, string>> = {
  sharp: {
    "--radius-xs":  "0px",
    "--radius-sm":  "0px",
    "--radius-md":  "2px",
    "--radius-lg":  "4px",
    "--radius-xl":  "6px",
    "--radius-2xl": "8px",
    "--radius-3xl": "10px",
    "--radius-full":"4px",
  },
  subtle: {
    "--radius-xs":  "0.125rem",
    "--radius-sm":  "0.1875rem",
    "--radius-md":  "0.25rem",
    "--radius-lg":  "0.375rem",
    "--radius-xl":  "0.5rem",
    "--radius-2xl": "0.625rem",
    "--radius-3xl": "0.75rem",
    "--radius-full":"4px",
  },
  rounded: {
    "--radius-xs":  "0.25rem",
    "--radius-sm":  "0.375rem",
    "--radius-md":  "0.5rem",
    "--radius-lg":  "0.75rem",
    "--radius-xl":  "1rem",
    "--radius-2xl": "1.25rem",
    "--radius-3xl": "1.5rem",
    "--radius-full":"9999px",
  },
  pill: {
    "--radius-xs":  "9999px",
    "--radius-sm":  "9999px",
    "--radius-md":  "9999px",
    "--radius-lg":  "9999px",
    "--radius-xl":  "9999px",
    "--radius-2xl": "9999px",
    "--radius-3xl": "9999px",
    "--radius-full":"9999px",
  },
};

// ─── SHADOW DENSITY MAPS ──────────────────────────────────────────────────────

const shadowDensityMaps: Record<ShadowDensity, Record<string, string>> = {
  flat: {
    "--shadow-xs":       "none",
    "--shadow-sm":       "none",
    "--shadow-md":       "0 1px 0 rgba(0 0 0 / 0.06)",
    "--shadow-lg":       "0 1px 0 rgba(0 0 0 / 0.06)",
    "--shadow-xl":       "0 1px 0 rgba(0 0 0 / 0.06)",
    "--shadow-2xl":      "0 1px 0 rgba(0 0 0 / 0.06)",
    "--shadow-floating": "0 4px 16px rgba(0 0 0 / 0.08)",
  },
  minimal: {
    "--shadow-xs":       "0 1px 2px rgba(0 0 0 / 0.04)",
    "--shadow-sm":       "0 1px 3px rgba(0 0 0 / 0.06)",
    "--shadow-md":       "0 2px 6px rgba(0 0 0 / 0.06)",
    "--shadow-lg":       "0 4px 10px rgba(0 0 0 / 0.07)",
    "--shadow-xl":       "0 6px 14px rgba(0 0 0 / 0.08)",
    "--shadow-floating": "0 8px 24px rgba(0 0 0 / 0.10)",
  },
  standard: {}, // uses defaults
  rich: {
    "--shadow-xs":       "0 1px 2px rgba(0 0 0 / 0.06), 0 1px 1px rgba(0 0 0 / 0.04)",
    "--shadow-sm":       "0 1px 3px rgba(0 0 0 / 0.08), 0 2px 4px rgba(0 0 0 / 0.06)",
    "--shadow-md":       "0 2px 6px rgba(0 0 0 / 0.06), 0 6px 12px rgba(0 0 0 / 0.08)",
    "--shadow-lg":       "0 4px 8px rgba(0 0 0 / 0.08), 0 12px 20px rgba(0 0 0 / 0.10)",
    "--shadow-xl":       "0 8px 14px rgba(0 0 0 / 0.09), 0 20px 36px rgba(0 0 0 / 0.11)",
    "--shadow-floating": "0 6px 12px rgba(0 0 0 / 0.08), 0 20px 40px rgba(0 0 0 / 0.12)",
  },
};

// ─── MOTION INTENSITY MAPS ────────────────────────────────────────────────────

const motionMaps: Record<MotionIntensity, Record<string, string>> = {
  none: {
    "--duration-75":   "0ms",
    "--duration-100":  "0ms",
    "--duration-150":  "0ms",
    "--duration-200":  "0ms",
    "--duration-300":  "0ms",
    "--duration-400":  "0ms",
    "--duration-600":  "0ms",
  },
  reduced: {
    "--duration-75":   "50ms",
    "--duration-100":  "75ms",
    "--duration-150":  "100ms",
    "--duration-200":  "150ms",
    "--duration-300":  "200ms",
    "--duration-400":  "250ms",
    "--duration-600":  "300ms",
  },
  subtle: {
    "--duration-75":   "60ms",
    "--duration-100":  "90ms",
    "--duration-150":  "120ms",
    "--duration-200":  "160ms",
    "--duration-300":  "220ms",
    "--duration-400":  "280ms",
    "--duration-600":  "350ms",
  },
  full: {}, // uses defaults
};

// ─── SPACING DENSITY MAPS ──────────────────────────────────────────────────────

const spacingMaps: Record<SpacingDensity, Record<string, string>> = {
  compact: {
    "--layout-component-xs":  "1.5rem",
    "--layout-component-sm":  "1.75rem",
    "--layout-component-md":  "2rem",
    "--layout-component-lg":  "2.25rem",
    "--layout-component-xl":  "2.5rem",
    "--layout-stack-sm":      "0.5rem",
    "--layout-stack-md":      "0.75rem",
    "--layout-stack-lg":      "1rem",
    "--layout-stack-xl":      "1.5rem",
  },
  normal: {}, // uses defaults
  spacious: {
    "--layout-component-xs":  "2rem",
    "--layout-component-sm":  "2.25rem",
    "--layout-component-md":  "2.75rem",
    "--layout-component-lg":  "3.25rem",
    "--layout-component-xl":  "3.75rem",
    "--layout-stack-sm":      "1rem",
    "--layout-stack-md":      "1.5rem",
    "--layout-stack-lg":      "2rem",
    "--layout-stack-xl":      "3rem",
  },
};

// ─── CSS GENERATOR ────────────────────────────────────────────────────────────

function serializeVars(vars: Record<string, string>): string {
  return Object.entries(vars)
    .filter(([, v]) => v !== "")
    .map(([k, v]) => `  ${k}: ${v};`)
    .join("\n");
}

/**
 * Generates a CSS block for a given tenant config.
 * Scoped to [data-tenant="id"] for zero bleed between tenants.
 */
export function generateTenantStylesheet(config: TenantBrandConfig): string {
  const vars: Record<string, string> = {};

  // Colors
  if (config.colors) {
    const { primaryH: h, primaryS: s, primaryL: l } = config.colors;
    // Remap all primary scale steps via the tenant's hue+saturation
    const steps = [25, 50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;
    const lightnesses = [98, 95, 90, 82, 70, 60, 50, 42, 34, 26, 18, 12] as const;
    steps.forEach((step, i) => {
      // Use tenant H+S but scale L to match the brand's original lightness distribution
      vars[`--color-primary-${step}`] = `hsl(${h} ${s} ${lightnesses[i]}%)`;
    });
    // Override semantic brand vars
    vars["--color-brand-primary"]          = `hsl(${h} ${s} ${l})`;
    vars["--color-brand-primaryHover"]     = `hsl(${h} ${s} calc(${l} - 8%))`;
    vars["--color-brand-primaryActive"]    = `hsl(${h} ${s} calc(${l} - 16%))`;
    vars["--color-brand-primarySubtle"]    = `hsl(${h} ${s} 95%)`;
    vars["--color-border-brand"]           = `hsl(${h} ${s} ${l})`;
    vars["--color-text-brand"]             = `hsl(${h} ${s} calc(${l} - 12%))`;
    vars["--color-text-link"]              = `hsl(${h} ${s} calc(${l} - 8%))`;
    vars["--color-border-focus"]           = `hsl(${h} ${s} ${l})`;

    if (config.colors.secondaryH) {
      const { secondaryH: sh, secondaryS: ss = s, secondaryL: sl = l } = config.colors;
      vars["--color-brand-secondary"]      = `hsl(${sh} ${ss} ${sl})`;
      vars["--color-brand-secondaryHover"] = `hsl(${sh} ${ss} calc(${sl} - 8%))`;
    }
  }

  // Radius
  if (config.radius && config.radius !== "rounded") {
    Object.assign(vars, radiusMaps[config.radius]);
  }

  // Shadow density
  if (config.shadows && config.shadows !== "standard") {
    Object.assign(vars, shadowDensityMaps[config.shadows]);
  }

  // Motion
  if (config.motion && config.motion !== "full") {
    Object.assign(vars, motionMaps[config.motion]);
  }

  // Spacing density
  if (config.spacing && config.spacing !== "normal") {
    Object.assign(vars, spacingMaps[config.spacing]);
  }

  // Typography
  if (config.fontSans) {
    vars["--font-sans"] = config.fontSans;
  }
  if (config.fontDisplay) {
    vars["--font-display"] = config.fontDisplay;
  }
  if (config.fontMono) {
    vars["--font-mono"] = config.fontMono;
  }

  // Custom vars (escape hatch)
  if (config.customVars) {
    Object.assign(vars, config.customVars);
  }

  const block = serializeVars(vars);
  if (!block) return "";

  return `[data-tenant="${config.id}"] {\n${block}\n}`;
}

/**
 * Generates CSS for all tenants in one stylesheet block.
 * Typically injected in a <style> tag in _app or layout.
 */
export function generateMultiTenantStylesheet(configs: TenantBrandConfig[]): string {
  return configs.map(generateTenantStylesheet).filter(Boolean).join("\n\n");
}

// ─── PRESET BRAND CONFIGS ─────────────────────────────────────────────────────
// Ready-to-use presets for common brand personalities

export const brandPresets: Record<string, TenantBrandConfig> = {
  fintech: {
    id: "preset-fintech",
    name: "Fintech",
    colors: { primaryH: "220", primaryS: "90%", primaryL: "50%" },
    radius: "subtle",
    shadows: "minimal",
    motion: "subtle",
    spacing: "compact",
  },
  hospitality: {
    id: "preset-hospitality",
    name: "Hospitality",
    colors: { primaryH: "25", primaryS: "80%", primaryL: "48%" },
    radius: "rounded",
    shadows: "rich",
    motion: "full",
    spacing: "spacious",
    fontDisplay: '"Playfair Display", Georgia, serif',
  },
  cyber: {
    id: "preset-cyber",
    name: "Cyber",
    colors: { primaryH: "142", primaryS: "80%", primaryL: "45%", secondaryH: "195", secondaryS: "100%", secondaryL: "45%" },
    radius: "sharp",
    shadows: "minimal",
    motion: "subtle",
    spacing: "compact",
    fontMono: '"JetBrains Mono", monospace',
  },
  luxury: {
    id: "preset-luxury",
    name: "Luxury",
    colors: { primaryH: "43", primaryS: "78%", primaryL: "38%" },
    radius: "sharp",
    shadows: "rich",
    motion: "subtle",
    spacing: "spacious",
    fontDisplay: '"Cormorant Garamond", Georgia, serif',
    fontSans: '"Optima", "Gill Sans", system-ui, sans-serif',
  },
  crypto: {
    id: "preset-crypto",
    name: "Crypto/Web3",
    colors: { primaryH: "262", primaryS: "84%", primaryL: "55%", secondaryH: "180", secondaryS: "100%", secondaryL: "45%" },
    radius: "rounded",
    shadows: "rich",
    motion: "full",
  },
  enterprise: {
    id: "preset-enterprise",
    name: "Enterprise",
    colors: { primaryH: "215", primaryS: "82%", primaryL: "48%" },
    radius: "sharp",
    shadows: "flat",
    motion: "reduced",
    spacing: "compact",
  },
  minimal: {
    id: "preset-minimal",
    name: "Minimal",
    colors: { primaryH: "0", primaryS: "0%", primaryL: "10%" },
    radius: "subtle",
    shadows: "flat",
    motion: "reduced",
  },
};

// ─── REACT HOOK ───────────────────────────────────────────────────────────────

export function useTenantBrand(config: TenantBrandConfig): void {
  if (typeof window === "undefined") return;

  const styleId = `tenant-style-${config.id}`;
  let el = document.getElementById(styleId) as HTMLStyleElement | null;

  if (!el) {
    el = document.createElement("style");
    el.id = styleId;
    document.head.appendChild(el);
  }

  el.textContent = generateTenantStylesheet(config);
  document.documentElement.setAttribute("data-tenant", config.id);
}
