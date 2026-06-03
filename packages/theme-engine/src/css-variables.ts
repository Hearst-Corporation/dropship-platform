/**
 * CSS VARIABLES GENERATOR
 * Converts design token objects into :root { --var: value } declarations.
 * Supports per-theme overrides, scoped tenant injection, and SSR.
 *
 * Usage:
 *   generateRootCss()              → light theme :root block
 *   generateThemeCss("dark")       → .theme-dark {} block
 *   generateTenantCss(tenantCfg)   → [data-tenant="id"] {} block
 */

import { colorPrimitive } from "../../design-tokens/src/colors.primitive";
import { themes, type ThemeName } from "../../design-tokens/src/colors.semantic";
import { spacing, layoutSpacing } from "../../design-tokens/src/spacing";
import { radius, componentRadius } from "../../design-tokens/src/radius";
import { shadowsLight, shadowsDark, shadowsLuxury } from "../../design-tokens/src/shadows";
import { duration, easing } from "../../design-tokens/src/motion";
import { zIndex } from "../../design-tokens/src/zindex";
import {
  fontFamily,
  fontWeight,
  fontSize,
  lineHeight,
  letterSpacing,
} from "../../design-tokens/src/typography";

// ─── PRIMITIVE COLOR VARS ─────────────────────────────────────────────────────

function primitiveColorVars(): Record<string, string> {
  const vars: Record<string, string> = {};

  for (const [colorName, scale] of Object.entries(colorPrimitive)) {
    if (colorName === "alpha") {
      const alphaScale = scale as Record<string, Record<string, string>>;
      for (const [variant, steps] of Object.entries(alphaScale)) {
        for (const [step, value] of Object.entries(steps)) {
          vars[`--color-${variant}-${step}`] = value;
        }
      }
    } else {
      for (const [step, value] of Object.entries(scale as Record<string, string>)) {
        vars[`--color-${colorName}-${step}`] = `hsl(${value})`;
      }
    }
  }

  return vars;
}

// ─── SPACING VARS ──────────────────────────────────────────────────────────────

function spacingVars(): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const [key, value] of Object.entries(spacing)) {
    vars[`--spacing-${key}`] = String(value);
  }
  for (const [key, value] of Object.entries(layoutSpacing)) {
    vars[`--layout-${key}`] = String(value);
  }
  return vars;
}

// ─── RADIUS VARS ───────────────────────────────────────────────────────────────

function radiusVars(): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const [key, value] of Object.entries(radius)) {
    vars[`--radius-${key}`] = value;
  }
  for (const [key, value] of Object.entries(componentRadius)) {
    vars[`--radius-component-${key}`] = value;
  }
  return vars;
}

// ─── TYPOGRAPHY VARS ──────────────────────────────────────────────────────────

function typographyVars(): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const [key, value] of Object.entries(fontFamily)) {
    vars[`--font-${key}`] = value;
  }
  for (const [key, value] of Object.entries(fontWeight)) {
    vars[`--font-weight-${key}`] = value;
  }
  for (const [key, value] of Object.entries(fontSize)) {
    vars[`--text-${key}`] = value;
  }
  for (const [key, value] of Object.entries(lineHeight)) {
    vars[`--leading-${key}`] = value;
  }
  for (const [key, value] of Object.entries(letterSpacing)) {
    vars[`--tracking-${key}`] = value;
  }
  return vars;
}

// ─── MOTION VARS ──────────────────────────────────────────────────────────────

function motionVars(): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const [key, value] of Object.entries(duration)) {
    vars[`--duration-${key}`] = value;
  }
  for (const [key, value] of Object.entries(easing)) {
    vars[`--ease-${key}`] = value;
  }
  return vars;
}

// ─── Z-INDEX VARS ─────────────────────────────────────────────────────────────

function zIndexVars(): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const [key, value] of Object.entries(zIndex)) {
    vars[`--z-${key}`] = String(value);
  }
  return vars;
}

// ─── SEMANTIC COLOR VARS ──────────────────────────────────────────────────────

function semanticColorVars(themeName: ThemeName): Record<string, string> {
  const theme = themes[themeName];
  const vars: Record<string, string> = {};

  const flattenObject = (obj: Record<string, unknown>, prefix: string) => {
    for (const [key, value] of Object.entries(obj)) {
      const varName = `${prefix}-${key}`;
      if (typeof value === "string") {
        vars[varName] = value;
      } else if (typeof value === "object" && value !== null) {
        flattenObject(value as Record<string, unknown>, varName);
      }
    }
  };

  flattenObject(theme as unknown as Record<string, unknown>, "--color");
  return vars;
}

// ─── SHADOW VARS ───────────────────────────────────────────────────────────────

function shadowVars(themeName: ThemeName): Record<string, string> {
  const vars: Record<string, string> = {};

  const shadowMap =
    themeName === "luxury-black"
      ? shadowsLuxury
      : ["dark", "amoled", "neon-cyberpunk"].includes(themeName)
      ? shadowsDark
      : shadowsLight;

  for (const [key, value] of Object.entries(shadowMap)) {
    vars[`--shadow-${key}`] = value;
  }
  return vars;
}

// ─── CSS SERIALIZER ───────────────────────────────────────────────────────────

function serializeVars(vars: Record<string, string>): string {
  return Object.entries(vars)
    .map(([k, v]) => `  ${k}: ${v};`)
    .join("\n");
}

// ─── PUBLIC API ───────────────────────────────────────────────────────────────

/** Generates the full :root block for the base (light) theme */
export function generateRootCss(): string {
  const all = {
    ...primitiveColorVars(),
    ...spacingVars(),
    ...radiusVars(),
    ...typographyVars(),
    ...motionVars(),
    ...zIndexVars(),
    ...semanticColorVars("light"),
    ...shadowVars("light"),
  };

  return `:root {\n${serializeVars(all)}\n}`;
}

/** Generates a .theme-{name} {} block that overrides semantic + shadow vars */
export function generateThemeCss(themeName: ThemeName): string {
  const override = {
    ...semanticColorVars(themeName),
    ...shadowVars(themeName),
  };

  // AMOLED/luxury use full-black bg — add explicit motion override
  if (themeName === "amoled" || themeName === "luxury-black") {
    override["--glass-blur"] = (themes[themeName] as { glass?: { blur?: string } }).glass?.blur ?? "blur(24px)";
  }

  return `.theme-${themeName} {\n${serializeVars(override)}\n}`;
}

/** Generates all theme CSS blocks */
export function generateAllThemesCss(): string {
  const themeNames = Object.keys(themes) as ThemeName[];
  return themeNames
    .filter((t) => t !== "light") // light is default :root
    .map(generateThemeCss)
    .join("\n\n");
}

/** Generates a tenant-scoped override block */
export function generateTenantCss(
  tenantId: string,
  overrides: Partial<{
    brandPrimary: string;
    brandSecondary: string;
    radius: string;
    fontFamily: string;
    [key: string]: string | undefined;
  }>
): string {
  const vars: Record<string, string> = {};

  if (overrides.brandPrimary) {
    vars["--color-brand-primary"]          = overrides.brandPrimary;
    vars["--color-brand-primaryHover"]     = overrides.brandPrimary;
  }
  if (overrides.brandSecondary) {
    vars["--color-brand-secondary"]        = overrides.brandSecondary;
  }
  if (overrides.radius) {
    // Override all radius tokens proportionally
    vars["--radius-md"]  = overrides.radius;
    vars["--radius-lg"]  = `calc(${overrides.radius} * 1.5)`;
    vars["--radius-xl"]  = `calc(${overrides.radius} * 2)`;
    vars["--radius-2xl"] = `calc(${overrides.radius} * 2.5)`;
  }
  if (overrides.fontFamily) {
    vars["--font-sans"]    = overrides.fontFamily;
    vars["--font-display"] = overrides.fontFamily;
  }

  // Allow arbitrary CSS var pass-through
  for (const [key, value] of Object.entries(overrides)) {
    if (key.startsWith("--") && value) {
      vars[key] = value;
    }
  }

  return `[data-tenant="${tenantId}"] {\n${serializeVars(vars)}\n}`;
}

/** Generates @media (prefers-reduced-motion) overrides */
export function generateReducedMotionCss(): string {
  return `@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}`;
}

/** Generates @media (prefers-color-scheme: dark) auto-switch */
export function generateAutoColorSchemeCss(): string {
  return `@media (prefers-color-scheme: dark) {
  :root:not([data-theme]) {
${serializeVars({ ...semanticColorVars("dark"), ...shadowVars("dark") })}
  }
}`;
}

/** Full stylesheet — root + all themes + reduced motion */
export function generateFullStylesheet(): string {
  return [
    generateRootCss(),
    "",
    generateAllThemesCss(),
    "",
    generateAutoColorSchemeCss(),
    "",
    generateReducedMotionCss(),
  ].join("\n");
}
