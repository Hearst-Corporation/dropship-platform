import type { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

/** Surface card — Tailwind Plus layout__cards (dark). gray-800/50 + ring. */
export function AdminCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('rounded-xl bg-gray-800/50 ring-1 ring-white/10', className)}>
      {children}
    </div>
  );
}

export function AdminCardHeader({
  title,
  eyebrow,
  action,
}: {
  title: ReactNode;
  eyebrow?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4">
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{eyebrow}</p>
        )}
        <h3 className="text-sm font-semibold text-white">{title}</h3>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
