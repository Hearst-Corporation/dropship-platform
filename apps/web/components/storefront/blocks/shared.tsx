/**
 * Shared primitives for the storefront marketing blocks.
 * Light theme (storefront), accent-driven, mobile-first. No Medusa, no
 * hardcoded colors outside the accent/zinc token system.
 */
import type { ReactNode } from 'react';

export function formatPrice(cents: number): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(cents / 100);
}

/** Section shell: consistent vertical rhythm + optional tint. */
export function Section({
  children,
  tint = 'plain',
  className = '',
  id,
}: {
  children: ReactNode;
  tint?: 'plain' | 'muted' | 'dark' | 'accent';
  className?: string;
  id?: string;
}) {
  const bg =
    tint === 'muted'
      ? 'bg-zinc-50'
      : tint === 'dark'
        ? 'bg-zinc-950 text-white'
        : tint === 'accent'
          ? 'bg-accent-600 text-white'
          : 'bg-white';
  return (
    <section id={id} className={`w-full ${bg} ${className}`}>
      <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-24">{children}</div>
    </section>
  );
}

/** Small uppercase eyebrow above a headline. */
export function Eyebrow({ children, onDark = false }: { children: ReactNode; onDark?: boolean }) {
  return (
    <p
      className={`mb-3 text-xs font-semibold uppercase tracking-[0.18em] ${
        onDark ? 'text-accent-300' : 'text-accent-600'
      }`}
    >
      {children}
    </p>
  );
}

export function Headline({ children, onDark = false }: { children: ReactNode; onDark?: boolean }) {
  return (
    <h2
      className={`text-balance text-3xl font-semibold tracking-tight sm:text-4xl ${
        onDark ? 'text-white' : 'text-zinc-950'
      }`}
    >
      {children}
    </h2>
  );
}

export function Lede({ children, onDark = false }: { children: ReactNode; onDark?: boolean }) {
  return (
    <p className={`mt-4 max-w-2xl text-lg/relaxed ${onDark ? 'text-zinc-300' : 'text-zinc-600'}`}>
      {children}
    </p>
  );
}

/** Primary storefront CTA. */
export function CtaButton({
  href,
  children,
  onDark = false,
}: {
  href: string;
  children: ReactNode;
  onDark?: boolean;
}) {
  return (
    <a
      href={href}
      className={`inline-flex items-center justify-center rounded-full px-8 py-3.5 text-sm font-semibold shadow-sm transition ${
        onDark
          ? 'bg-white text-zinc-950 hover:bg-zinc-100'
          : 'bg-accent-600 text-white hover:bg-accent-700'
      }`}
    >
      {children}
    </a>
  );
}
