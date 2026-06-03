'use client';

import Link from 'next/link';

/**
 * Breadcrumb "← Stores" link with a muted→primary hover.
 *
 * Extracted from the store layout because that layout is a Server Component
 * (async data fetch) and React forbids passing event handlers
 * (onMouseEnter/onMouseLeave) from a Server Component to its children.
 * The hover is purely cosmetic, so it lives in this tiny client island.
 */
export function BreadcrumbBackLink() {
  return (
    <Link
      href="/admin/stores"
      style={{ color: 'var(--ct-text-muted)', textDecoration: 'none', transition: 'color var(--ct-dur-base)' }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = 'var(--ct-text-primary)'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = 'var(--ct-text-muted)'; }}
    >
      ← Stores
    </Link>
  );
}
