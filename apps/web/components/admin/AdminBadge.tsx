import type { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

/** Status badge — Tailwind Plus elements__badges (flat-with-dot). */
export type AdminBadgeColor = 'zinc' | 'green' | 'amber' | 'red' | 'indigo';

const styles: Record<AdminBadgeColor, string> = {
  zinc: 'bg-zinc-50 text-zinc-600 ring-zinc-500/20',
  green: 'bg-green-50 text-green-700 ring-green-600/20',
  amber: 'bg-amber-50 text-amber-800 ring-amber-600/20',
  red: 'bg-red-50 text-red-700 ring-red-600/20',
  indigo: 'bg-indigo-50 text-indigo-700 ring-indigo-700/20',
};

const dots: Record<AdminBadgeColor, string> = {
  zinc: 'fill-zinc-400',
  green: 'fill-green-500',
  amber: 'fill-amber-500',
  red: 'fill-red-500',
  indigo: 'fill-indigo-500',
};

export function AdminBadge({
  color = 'zinc',
  children,
}: {
  color?: AdminBadgeColor;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-x-1.5 rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset',
        styles[color],
      )}
    >
      <svg viewBox="0 0 6 6" aria-hidden className={cn('size-1.5', dots[color])}>
        <circle cx={3} cy={3} r={3} />
      </svg>
      {children}
    </span>
  );
}
