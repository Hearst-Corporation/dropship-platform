"use client";

import { ChevronLeftIcon } from "@heroicons/react/20/solid";
import { TextLink } from "@/components/ui/text";

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
    <TextLink
      href="/admin/stores"
      className="inline-flex items-center gap-1 no-underline"
    >
      <ChevronLeftIcon className="size-4" aria-hidden="true" />
      Stores
    </TextLink>
  );
}

export default BreadcrumbBackLink;
