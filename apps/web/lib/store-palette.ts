/**
 * Store palette — engine-side, decoupled from any UI design system.
 *
 * The storefront now renders through the unified Catalyst design system
 * (indigo accent by default), so stores no longer carry a per-store visual
 * "preset". But the DB contract (`dropship_stores.design_preset` + `.palette`)
 * still exists, so the engine keeps writing a coherent palette: the operator's
 * chosen primary/accent over the product's dark neutral tokens.
 */
export interface StorePalette {
  primary: string;
  accent: string;
  bg: string;
  surface: string;
  text: string;
  textMuted: string;
  border: string;
  success: string;
  danger: string;
}

/** Indigo — the platform accent. */
export const DEFAULT_ACCENT = '#6366f1';
export const DEFAULT_PRESET = 'indigo';

const DARK_NEUTRALS = {
  bg: '#09090b',
  surface: '#18181b',
  text: '#ffffff',
  textMuted: '#a1a1aa',
  border: 'rgba(255,255,255,0.10)',
} as const;

/** Build a coherent store palette from operator-chosen colors (or defaults). */
export function buildStorePalette(primary?: string, accent?: string): StorePalette {
  return {
    primary: primary || DARK_NEUTRALS.surface,
    accent: accent || DEFAULT_ACCENT,
    ...DARK_NEUTRALS,
    success: '#16a34a',
    danger: '#dc2626',
  };
}
