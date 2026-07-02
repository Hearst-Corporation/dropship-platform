import clsx from "clsx";
import type React from "react";
import { adminPanel } from "./admin-surface";

/**
 * Surface wrapper for a Catalyst <Table>. Clips horizontal overflow by default
 * so rows truncate instead of scrolling sideways. Pass `scrollable` for wide
 * tables that genuinely need horizontal scroll.
 */
export interface AdminDataTableProps {
  children: React.ReactNode;
  className?: string;
  /** Use table-fixed so truncate-friendly column widths apply. */
  fixedLayout?: boolean;
  /** Allow horizontal scroll (off by default). */
  scrollable?: boolean;
}

export function AdminDataTable({
  children,
  className,
  fixedLayout = false,
  scrollable,
}: AdminDataTableProps) {
  const allowScroll = scrollable ?? !fixedLayout;

  return (
    <div
      className={clsx(
        className,
        adminPanel,
        "relative min-w-0 overflow-hidden rounded-xl",
        fixedLayout && "[--gutter:--spacing(6)]",
      )}
    >
      <div
        className={clsx(
          "min-w-0",
          allowScroll ? "overflow-x-auto" : "overflow-x-clip",
        )}
      >
        {children}
      </div>
    </div>
  );
}
