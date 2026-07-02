import clsx from "clsx";
import type React from "react";
import { PhotoIcon } from "@heroicons/react/24/outline";

/**
 * Two-line asset cell for dense admin tables: a square thumbnail (with a
 * PhotoIcon fallback when no image), a bold title, an optional subtitle, and
 * an optional mono handle chip. Everything truncates so rows stay one line.
 * Dark-mode aware. Server-safe.
 *
 * Uses a plain <img> (not next/image) on purpose: supplier thumbnails come
 * from arbitrary external hosts (AliExpress/CJ) that aren't in the next.config
 * remotePatterns allowlist.
 */
export interface AdminAssetCellProps {
  imageUrl?: string | null;
  title: string;
  subtitle?: string;
  /** Slug/handle rendered as a small mono chip. */
  handle?: string;
  /** Trailing badge (e.g. status) aligned to the title row. */
  badge?: React.ReactNode;
  className?: string;
}

export function AdminAssetCell({
  imageUrl,
  title,
  subtitle,
  handle,
  badge,
  className,
}: AdminAssetCellProps) {
  return (
    <div className={clsx(className, "flex min-w-0 items-center gap-3")}>
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt=""
          className="size-11 shrink-0 rounded-lg object-cover ring-1 ring-admin-ring"
        />
      ) : (
        <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-admin-surface-inset ring-1 ring-admin-ring">
          <PhotoIcon className="size-5 text-zinc-400 text-zinc-500" />
        </div>
      )}
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium text-white">{title}</span>
          {badge}
        </div>
        {subtitle ? (
          <div className="truncate text-xs text-zinc-500 text-zinc-400">
            {subtitle}
          </div>
        ) : null}
        {handle ? (
          <div className="mt-0.5 truncate font-mono text-[0.6875rem] text-zinc-400 text-zinc-500">
            {handle}
          </div>
        ) : null}
      </div>
    </div>
  );
}
