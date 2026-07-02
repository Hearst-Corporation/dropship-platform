import clsx from "clsx";
import { adminKpiSkeleton, adminKpiStrip } from "@/components/admin/admin-surface";

export default function Loading() {
  return (
    <div className="animate-pulse space-y-8">
      <div className="flex flex-col gap-4 pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="h-8 w-64 rounded-lg bg-admin-surface-inset" />
          <div className="h-4 w-96 max-w-full rounded bg-admin-surface-inset" />
          <div className="h-3 w-40 rounded bg-admin-surface-inset" />
        </div>
        <div className="h-9 w-36 shrink-0 rounded-lg bg-admin-surface-inset" />
      </div>

      <div className={clsx(adminKpiStrip, "sm:grid-cols-2 2xl:grid-cols-4")}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={clsx("h-24", adminKpiSkeleton)} />
        ))}
      </div>

      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="h-9 w-full max-w-xs rounded-lg bg-admin-surface-inset" />
          <div className="h-9 w-40 rounded-lg bg-admin-surface-inset" />
        </div>
        <div className="h-96 rounded-xl border border-admin-border bg-admin-surface-inset" />
      </div>
    </div>
  );
}
