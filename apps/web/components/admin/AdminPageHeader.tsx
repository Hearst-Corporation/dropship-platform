import clsx from "clsx";
import type React from "react";
import { Heading } from "@/components/catalyst/heading";
import { adminDivider, adminTextMuted } from "./admin-surface";

/**
 * Standard admin page header: title row (Catalyst Heading) with right-aligned
 * actions, an optional subtitle line, and an optional meta strip underneath.
 * Server-safe (no client hooks).
 */
export interface AdminPageHeaderProps {
  title: string;
  subtitle?: string;
  /** Small meta strip rendered under the title (counts, updated-at, etc.). */
  meta?: React.ReactNode;
  /** Right-aligned action buttons. */
  actions?: React.ReactNode;
  className?: string;
}

export function AdminPageHeader({
  title,
  subtitle,
  meta,
  actions,
  className,
}: AdminPageHeaderProps) {
  return (
    <div
      className={clsx(
        className,
        "relative flex-col gap-6 border-b pb-8 sm:flex-row sm:items-end sm:justify-between",
        adminDivider,
      )}
    >
      <div className="flex min-w-0 gap-6">
        <span
          className="mt-2 hidden w-1.5 shrink-0 self-stretch bg-indigo-500 sm:block"
          aria-hidden
        />
        <div className="min-w-0">
          <Heading>{title}</Heading>
          {subtitle ? (
            <p className={clsx("mt-2 max-w-2xl text-sm", adminTextMuted)}>
              {subtitle}
            </p>
          ) : null}
          {meta ? (
            <div
              className={clsx(
                "mt-4 flex-wrap items-center gap-x-4 gap-y-2 text-[10px] font-bold uppercase tracking-widest",
                adminTextMuted,
              )}
            >
              {meta}
            </div>
          ) : null}
        </div>
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-3 sm:justify-end">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
