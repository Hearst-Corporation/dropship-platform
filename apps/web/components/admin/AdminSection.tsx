import clsx from "clsx";
import type React from "react";
import {
  adminAccentTop,
  adminHighlightWash,
  adminPanel,
  adminSectionHeader,
  adminText,
  adminTextMuted,
} from "./admin-surface";

/**
 * A titled card surface for the admin (dark-mode aware). Wraps content in a
 * rounded bordered panel; renders an optional header row with title,
 * description and right-aligned actions. Server-safe.
 */
export interface AdminSectionProps {
  title?: string;
  description?: string;
  /** Right-aligned actions in the header row. */
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /** Drop the inner padding (useful when the child is a full-bleed table). */
  flush?: boolean;
  /** Subtle indigo gradient wash — for dashboard hero panels. */
  highlight?: boolean;
}

export function AdminSection({
  title,
  description,
  actions,
  children,
  className,
  flush = false,
  highlight = false,
}: AdminSectionProps) {
  const hasHeader = Boolean(title || description || actions);
  return (
    <section
      className={clsx(
        className,
        adminPanel,
        adminAccentTop,
        "relative overflow-hidden rounded-xl",
        highlight && adminHighlightWash,
      )}
    >
      {hasHeader ? (
        <div
          className={clsx(
            adminSectionHeader,
            "relative flex flex-col gap-4 px-6 py-5 sm:flex-row sm:items-end sm:justify-between",
          )}
        >
          <div className="min-w-0">
            {title ? (
              <h2
                className={clsx(
                  "flex items-center gap-3 text-admin-kicker font-bold uppercase tracking-[0.15em]",
                  adminText,
                )}
              >
                <span
                  className="hidden size-2.5 shrink-0 bg-indigo-500 sm:inline-block"
                  aria-hidden
                />
                {title}
              </h2>
            ) : null}
            {description ? (
              <p className={clsx("mt-1.5 text-xs font-medium", adminTextMuted)}>
                {description}
              </p>
            ) : null}
          </div>
          {actions ? (
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {actions}
            </div>
          ) : null}
        </div>
      ) : null}
      <div className={clsx("relative", !flush && "p-6 sm:p-8")}>{children}</div>
    </section>
  );
}
