import clsx from "clsx";
import { adminKpiSkeleton, adminKpiStrip } from "@/components/admin/admin-surface";

export default function Loading() {
  return (
    <div className="animate-pulse space-y-8" aria-hidden="true">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="h-3 w-32 rounded bg-admin-surface-inset" />
          <div className="h-7 w-72 max-w-full rounded bg-admin-surface-inset" />
          <div className="h-4 w-36 rounded bg-admin-surface-inset" />
        </div>
        <div className="flex items-center gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-9 w-20 rounded-lg bg-admin-surface-inset" />
          ))}
        </div>
      </div>

      <div>
        <div className="h-5 w-36 rounded bg-admin-surface-inset" />
        <div className={clsx(adminKpiStrip, "mt-4 sm:grid-cols-2 xl:grid-cols-4")}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={clsx("h-24", adminKpiSkeleton)} />
          ))}
        </div>
      </div>

      <div className="border-t border-admin-border pt-8">
        <div className="h-5 w-44 rounded bg-admin-surface-inset" />
        <div className="mt-4 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between gap-6">
              <div className="h-4 w-40 rounded bg-admin-surface-inset" />
              <div className="h-4 w-12 rounded bg-admin-surface-inset" />
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-admin-border pt-8">
        <div className="h-5 w-40 rounded bg-admin-surface-inset" />
        <div className="mt-4 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-8 w-full rounded bg-admin-surface-inset" />
          ))}
        </div>
      </div>

      <div className="border-t border-admin-border pt-8">
        <div className="h-5 w-48 rounded bg-admin-surface-inset" />
        <div className="mt-4 flex flex-wrap gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-6 w-28 rounded-md bg-admin-surface-inset" />
          ))}
        </div>
      </div>
    </div>
  );
}
