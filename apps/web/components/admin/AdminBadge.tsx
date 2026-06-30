import type { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

/** Status badge — Tailwind Plus elements__badges (dark, flat-with-dot). */
export type AdminBadgeColor = 'zinc' | 'green' | 'amber' | 'red' | 'indigo';

const styles: Record<AdminBadgeColor, string> = {
  zinc: 'bg-gray-400/10 text-gray-400 ring-gray-400/20',
  green: 'bg-green-500/10 text-green-400 ring-green-500/20',
  amber: 'bg-amber-400/10 text-amber-400 ring-amber-400/20',
  red: 'bg-rose-500/10 text-rose-400 ring-rose-500/20',
  indigo: 'bg-indigo-500/10 text-indigo-400 ring-indigo-500/30',
};

const dots: Record<AdminBadgeColor, string> = {
  zinc: 'fill-gray-400',
  green: 'fill-green-400',
  amber: 'fill-amber-400',
  red: 'fill-rose-400',
  indigo: 'fill-indigo-400',
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
