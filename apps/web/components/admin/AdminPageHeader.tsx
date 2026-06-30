import type { ReactNode } from 'react';

/**
 * Page header — Tailwind Plus headings__page-headings (with-actions).
 * Thin presentation wrapper, no proprietary tokens. Zinc/indigo SaaS.
 */
export function AdminPageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="border-b border-zinc-200 pb-5 sm:flex sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">{eyebrow}</p>
        )}
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900">{title}</h1>
        {description && <p className="mt-2 max-w-3xl text-sm text-zinc-500">{description}</p>}
      </div>
      {actions && <div className="mt-4 flex shrink-0 items-center gap-3 sm:mt-0 sm:ml-4">{actions}</div>}
    </div>
  );
}
