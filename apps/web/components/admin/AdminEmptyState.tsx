import clsx from "clsx";
import type React from "react";
import { adminInset, adminText, adminTextMuted } from "./admin-surface";

/**
 * Centered empty state for admin lists/tables. Optional icon, title,
 * description and a single call-to-action slot. Dark-mode aware. Server-safe.
 */
export interface AdminEmptyStateProps {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function AdminEmptyState({
  icon: Icon,
  title,
  description,
  action,
}: AdminEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
      {Icon ? (
        <div
          className={clsx(
            "mb-6 flex size-12 items-center justify-center rounded-xl",
            adminInset,
          )}
        >
          <Icon className="size-6 text-zinc-500" />
        </div>
      ) : null}
      <h3
        className={clsx(
          "text-admin-kicker font-bold uppercase tracking-[0.15em]",
          adminText,
        )}
      >
        {title}
      </h3>
      {description ? (
        <p
          className={clsx("mt-2 max-w-sm text-sm font-medium", adminTextMuted)}
        >
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
