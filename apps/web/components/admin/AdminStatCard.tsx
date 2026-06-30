import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * KPI grid + card — Tailwind Plus data-display__stats (dark, simple-in-cards).
 * Optional href turns the card into a drill-down link.
 */
export function AdminStatGrid({ children }: { children: ReactNode }) {
  return (
    <dl className="grid grid-cols-1 gap-px overflow-hidden rounded-xl bg-white/10 ring-1 ring-white/10 sm:grid-cols-2 lg:grid-cols-4">
      {children}
    </dl>
  );
}

export function AdminStatCard({
  label,
  value,
  hint,
  href,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  href?: string;
}) {
  const inner = (
    <>
      <dt className="truncate text-sm font-medium text-gray-400">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold tracking-tight tabular-nums text-white">{value}</dd>
      {hint && <dd className="mt-1 text-xs text-gray-500">{hint}</dd>}
    </>
  );
  if (href) {
    return (
      <Link href={href} className="bg-gray-900 px-4 py-5 transition-colors hover:bg-gray-800/60 sm:px-6">
        {inner}
      </Link>
    );
  }
  return <div className="bg-gray-900 px-4 py-5 sm:px-6">{inner}</div>;
}
