import type { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

/** Surface card — Tailwind Plus layout__cards. White, ring, soft shadow. */
export function AdminCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('rounded-xl bg-white shadow-sm ring-1 ring-zinc-200', className)}>
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
    <div className="flex items-start justify-between gap-4 border-b border-zinc-100 px-5 py-4">
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">{eyebrow}</p>
        )}
        <h3 className="text-sm font-semibold text-zinc-900">{title}</h3>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
