'use client';

import Link from 'next/link';
import { ChevronLeftIcon } from '@heroicons/react/20/solid';

/**
 * Breadcrumb "Stores" back link with a muted→light hover.
 *
 * Extracted from the store layout because that layout is a Server Component
 * (async data fetch) and React forbids passing event handlers from a Server
 * Component to its children. The hover is purely cosmetic CSS so it lives in
 * this tiny client island.
 */
export function BreadcrumbBackLink() {
  return (
    <Link
      href="/admin/stores"
      className="inline-flex items-center gap-1 text-gray-400 transition-colors hover:text-white"
    >
      <ChevronLeftIcon className="size-4" aria-hidden="true" />
      Stores
    </Link>
  );
}

export default BreadcrumbBackLink;
