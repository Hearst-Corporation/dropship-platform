import type React from "react";
import { AdminTruncatedText } from "./AdminTruncatedText";

export interface AdminStoreCellProps {
  name: string;
  slug: string;
  niche?: string | null;
  /** Thumbnail slot (36–40px). */
  media: React.ReactNode;
}

/**
 * Store identity cell for admin tables: avatar + truncated name + slug/niche
 * subline. Long slugs and niches ellipsize; full text on hover via title.
 */
export function AdminStoreCell({
  name,
  slug,
  niche,
  media,
}: AdminStoreCellProps) {
  const slugPath = `/shop/${slug}`;
  const nicheClean = niche?.trim() || null;
  const subline = nicheClean ? `${slugPath} · ${nicheClean}` : slugPath;

  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="shrink-0">{media}</div>
      <div className="min-w-0 flex-1">
        <AdminTruncatedText as="p" className="font-medium text-white" title={name}>
          {name}
        </AdminTruncatedText>
        <AdminTruncatedText
          as="p"
          className="text-xs text-zinc-500"
          title={subline}
        >
          {subline}
        </AdminTruncatedText>
      </div>
    </div>
  );
}
