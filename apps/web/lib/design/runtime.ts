/**
 * Server-side helpers that turn `dropship_stores.design_preset` + `.palette`
 * into the runtime artifacts the storefront actually consumes:
 *   - A `<style>` block exposing every palette color + the typography family
 *     stacks as CSS custom properties (so any descendant component can read
 *     `var(--ds-primary)` / `var(--ds-font-display)` without prop drilling).
 *   - A `<link>` to Google Fonts loading exactly the weights the chosen
 *     preset needs (no preload of weights we don't use).
 *
 * Both are rendered inside the storefront layout. Templates read `var(--ds-*)`
 * everywhere instead of inventing colors or fonts on the fly.
 */

import type { StoreConfig } from '@/lib/store-config';
import { DESIGN_PRESETS, type DesignPreset, type StorePalette } from './presets';

// Fonts that Google Fonts actually hosts. The rest (Migra, PP Editorial New,
// General Sans, Satoshi, Geist) are commercial / Fontshare. For those we
// either fall back to a close Google equivalent OR self-host them later.
// Keep the mapping explicit so we never silently load a font that 404s.
//
// `weights` here are the map's defaults — `buildGoogleFontsUrl()` unions them
// with whatever weight array the chosen preset actually requests
// (`preset.fonts.display.weights` / `.body.weights`), so listing a superset
// of commonly-needed weights per family is safe: every preset gets at least
// what it asks for, and shared entries (e.g. Inter, Poppins, Archivo used by
// several presets with different weight sets) resolve correctly for all of
// them without needing preset-specific branches.
const GOOGLE_FONT_FAMILIES: Record<string, { google: string; weights: number[]; italic?: boolean } | null> = {
  // Editorial serif
  'Instrument Serif': { google: 'Instrument+Serif', weights: [400], italic: true },
  'Inter Tight': { google: 'Inter+Tight', weights: [400, 500, 600] },
  'Fraunces': { google: 'Fraunces', weights: [400, 600], italic: true },
  // Common fall-backs
  'Geist': { google: 'Geist', weights: [400, 500, 600, 800] },
  'Playfair Display': { google: 'Playfair+Display', weights: [400, 700], italic: true },
  'Plus Jakarta Sans': { google: 'Plus+Jakarta+Sans', weights: [400, 500, 600, 700] },
  // Fontshare-only families — return null so we skip the Google Fonts <link>
  // for them. The CSS-var stack still names them, so a self-hosted @font-face
  // in the future will be picked up automatically.
  'Satoshi': null,
  'General Sans': null,
  'Migra': null,
  'PP Editorial New': null,

  // --- Added for the 20 new presets (2026-07) ---
  'Space Grotesk': { google: 'Space+Grotesk', weights: [400, 500, 600, 700] },
  'Baloo 2': { google: 'Baloo+2', weights: [400, 500, 600, 700, 800] },
  'Karla': { google: 'Karla', weights: [400, 500, 600, 700] },
  'Cormorant Garamond': { google: 'Cormorant+Garamond', weights: [400, 500, 600], italic: true },
  'Work Sans': { google: 'Work+Sans', weights: [400, 500, 600, 700] },
  'Fredoka': { google: 'Fredoka', weights: [400, 500, 600, 700] },
  'Quicksand': { google: 'Quicksand', weights: [400, 500, 600, 700] },
  'Cormorant': { google: 'Cormorant', weights: [400, 500, 600, 700], italic: true },
  'Jost': { google: 'Jost', weights: [400, 500, 600] },
  'Oswald': { google: 'Oswald', weights: [400, 500, 600, 700] },
  'Barlow': { google: 'Barlow', weights: [400, 500, 600, 700] },
  'Rajdhani': { google: 'Rajdhani', weights: [400, 500, 600, 700] },
  'Titillium Web': { google: 'Titillium+Web', weights: [400, 600, 700] },
  'Archivo Expanded': { google: 'Archivo+Expanded', weights: [400, 600, 700] },
  'Archivo': { google: 'Archivo', weights: [400, 500, 600, 700] },
  'Marcellus': { google: 'Marcellus', weights: [400] },
  'Mulish': { google: 'Mulish', weights: [400, 500, 600, 700] },
  'Manrope': { google: 'Manrope', weights: [400, 500, 600, 700, 800] },
  'Poiret One': { google: 'Poiret+One', weights: [400] },
  'Josefin Sans': { google: 'Josefin+Sans', weights: [400, 500, 600, 700] },
  'Space Mono': { google: 'Space+Mono', weights: [400, 700], italic: true },
  'IBM Plex Mono': { google: 'IBM+Plex+Mono', weights: [400, 500, 600] },
  'Poppins': { google: 'Poppins', weights: [400, 500, 600, 700] },
  'Nunito Sans': { google: 'Nunito+Sans', weights: [400, 500, 600, 700] },
  'Libre Franklin': { google: 'Libre+Franklin', weights: [400, 500, 600, 700] },
  'Source Sans 3': { google: 'Source+Sans+3', weights: [400, 500, 600, 700] },
  'Bebas Neue': { google: 'Bebas+Neue', weights: [400] },
  'Roboto Slab': { google: 'Roboto+Slab', weights: [400, 500, 600, 700] },
  'Shippori Mincho': { google: 'Shippori+Mincho', weights: [400, 500, 600, 700] },
  'Zen Kaku Gothic New': { google: 'Zen+Kaku+Gothic+New', weights: [400, 500, 700] },
  'Bricolage Grotesque': { google: 'Bricolage+Grotesque', weights: [400, 500, 600, 700, 800] },
  'DM Sans': { google: 'DM+Sans', weights: [400, 500, 600, 700] },
  'Inter': { google: 'Inter', weights: [400, 500, 600] },
};

export interface RuntimeDesign {
  preset: DesignPreset;
  palette: StorePalette;
  /** Ready-to-inject Google Fonts URL or null if everything is self-hosted/system. */
  googleFontsUrl: string | null;
  /** Inline CSS to drop in a `<style>` tag inside the layout. */
  cssVars: string;
}

export function resolveDesign(store: StoreConfig): RuntimeDesign {
  // Fallback chain: explicit preset → first curated preset (editorial-serif).
  const preset =
    DESIGN_PRESETS.find((p) => p.slug === store.designPreset) ?? DESIGN_PRESETS[0]!;

  // Palette priority: structured `palette` column → legacy primary/accent
  // padded with the preset's neutrals → preset neutrals only. Every code
  // path below sees a fully populated StorePalette.
  const palette: StorePalette = store.palette ?? {
    primary: store.primaryColor || preset.neutrals.text,
    accent: store.accentColor || preset.neutrals.text,
    bg: preset.neutrals.bg,
    surface: preset.neutrals.surface,
    text: preset.neutrals.text,
    textMuted: preset.neutrals.textMuted,
    border: preset.neutrals.border,
    success: '#16a34a',
    danger: '#dc2626',
  };

  const googleFontsUrl = buildGoogleFontsUrl(preset);
  const cssVars = buildCssVars(preset, palette);

  return { preset, palette, googleFontsUrl, cssVars };
}

function buildGoogleFontsUrl(preset: DesignPreset): string | null {
  const families = [preset.fonts.display, preset.fonts.body];
  const params: string[] = [];
  for (const f of families) {
    const mapped = GOOGLE_FONT_FAMILIES[f.family];
    if (!mapped) continue;
    // Google Fonts CSS API v2 syntax:
    //   family=Name:ital,wght@0,400;0,600;1,400
    const weights = Array.from(new Set([...mapped.weights, ...f.weights])).sort((a, b) => a - b);
    const ital = mapped.italic || f.italic;
    const axes = ital
      ? `ital,wght@${weights.map((w) => `0,${w}`).join(';')};${weights.map((w) => `1,${w}`).join(';')}`
      : `wght@${weights.join(';')}`;
    params.push(`family=${mapped.google}:${axes}`);
  }
  if (params.length === 0) return null;
  return `https://fonts.googleapis.com/css2?${params.join('&')}&display=swap`;
}

// Palette colors and font names come from per-store DB rows, so any value
// interpolated into the inline `<style>` block must be sanitized first: a
// malicious value containing `</style>` (or `<`/`>`/`{`/`}`/`;`) could break
// out of the style context and inject markup. We strip the characters that
// have structural meaning inside a CSS declaration block and the `<`/`>` that
// could terminate the `<style>` element, while keeping the alphanumerics that
// make up hex colors, units and named values.
function cssSafe(value: string): string {
  return String(value).replace(/[<>{}();@"'\\]/g, '').trim();
}

// Font family stacks need to keep commas, spaces and quotes (e.g.
// `'Instrument Serif', Georgia, serif`) but must still never carry `<`/`>`
// or a declaration/element terminator.
function cssSafeFontStack(value: string): string {
  return String(value).replace(/[<>{};@()\\]/g, '').trim();
}

function buildCssVars(preset: DesignPreset, palette: StorePalette): string {
  const displayFamily = cssSafe(preset.fonts.display.family);
  const bodyFamily = cssSafe(preset.fonts.body.family);
  const displayStack = cssSafeFontStack(`'${displayFamily}', Georgia, serif`);
  const bodyStack = cssSafeFontStack(
    `'${bodyFamily}', system-ui, -apple-system, 'Inter', sans-serif`,
  );
  const radius =
    preset.ui.radius === 'sharp' ? '4px' : preset.ui.radius === 'pill' ? '999px' : '12px';
  const headingTracking = cssSafe(String(preset.ui.headingTracking));

  return `
:root {
  --ds-primary: ${cssSafe(palette.primary)};
  --ds-accent: ${cssSafe(palette.accent)};
  --ds-bg: ${cssSafe(palette.bg)};
  --ds-surface: ${cssSafe(palette.surface)};
  --ds-text: ${cssSafe(palette.text)};
  --ds-text-muted: ${cssSafe(palette.textMuted)};
  --ds-border: ${cssSafe(palette.border)};
  --ds-success: ${cssSafe(palette.success)};
  --ds-danger: ${cssSafe(palette.danger)};
  --ds-font-display: ${displayStack};
  --ds-font-body: ${bodyStack};
  --ds-radius: ${radius};
  --ds-heading-tracking: ${headingTracking}em;
}
`.trim();
}
