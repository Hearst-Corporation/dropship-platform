import type { CSSProperties } from 'react';

/**
 * Design-system CSS custom properties injected by `shop/[slug]/layout.tsx`
 * via `resolveDesign()`. Templates read these instead of `store.primaryColor`
 * or hardcoded Tailwind neutrals.
 */
export const DS = {
  primary: 'var(--ds-primary)',
  accent: 'var(--ds-accent)',
  bg: 'var(--ds-bg)',
  surface: 'var(--ds-surface)',
  text: 'var(--ds-text)',
  textMuted: 'var(--ds-text-muted)',
  border: 'var(--ds-border)',
  success: 'var(--ds-success)',
  danger: 'var(--ds-danger)',
  fontDisplay: 'var(--ds-font-display)',
  fontBody: 'var(--ds-font-body)',
  radius: 'var(--ds-radius)',
  headingTracking: 'var(--ds-heading-tracking)',
} as const;

/** Tailwind arbitrary-value helpers. */
export const dsClass = {
  bg: 'bg-[var(--ds-bg)]',
  surface: 'bg-[var(--ds-surface)]',
  text: 'text-[var(--ds-text)]',
  textMuted: 'text-[var(--ds-text-muted)]',
  border: 'border-[var(--ds-border)]',
} as const;

export function dsStyle(
  props: Partial<Record<'color' | 'backgroundColor' | 'borderColor' | 'fontFamily', string>>,
): CSSProperties {
  return props;
}
