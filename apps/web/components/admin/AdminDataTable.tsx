import clsx from "clsx";
import type React from "react";
import { adminPanel } from "./admin-surface";

/**
 * Surface wrapper for a Catalyst <Table>. Wraps the table in a bordered,
 * rounded, dark-mode-aware panel that scrolls horizontally on its own.
 */
export interface AdminDataTableProps {
  children: React.ReactNode;
  className?: string;
}

export function AdminDataTable({ children, className }: AdminDataTableProps) {
  return (
    <div
      className={clsx(
        className,
        adminPanel,
        "relative overflow-hidden rounded-xl",
      )}
    >
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}
