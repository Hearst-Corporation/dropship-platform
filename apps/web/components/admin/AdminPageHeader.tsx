import type { ReactNode } from 'react';

/**
 * Page header — Tailwind Plus headings__page-headings (dark, with-actions).
 * Thin presentation wrapper, no proprietary tokens.
 */
export function AdminPageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="border-b border-white/10 pb-5 sm:flex sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-400">{eyebrow}</p>
        )}
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">{title}</h1>
        {description && <p className="mt-2 max-w-3xl text-sm text-gray-400">{description}</p>}
      </div>
      {actions && <div className="mt-4 flex shrink-0 items-center gap-3 sm:mt-0 sm:ml-4">{actions}</div>}
    </div>
  );
}
