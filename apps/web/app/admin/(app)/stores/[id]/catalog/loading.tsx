import clsx from "clsx";
import { adminKpiSkeleton, adminKpiStrip } from "@/components/admin/admin-surface";

export default function Loading() {
  return (
    <div className="space-y-8 animate-pulse" aria-hidden="true">
      <div className="flex min-w-0 flex-wrap items-end justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <div className="h-3 w-24 rounded bg-admin-surface-inset" />
          <div className="h-7 w-56 rounded bg-admin-surface-inset" />
          <div className="h-4 w-80 rounded bg-admin-surface-inset" />
        </div>
        <div className="h-9 w-48 rounded-lg bg-admin-surface-inset" />
      </div>

      <div className="border-t border-admin-border pt-8">
        <div className="h-5 w-24 rounded bg-admin-surface-inset" />
        <div className={clsx(adminKpiStrip, "mt-4 sm:grid-cols-2 xl:grid-cols-4")}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={clsx("h-24", adminKpiSkeleton)} />
          ))}
        </div>
      </div>

      <div className="border-t border-admin-border pt-8">
        <div className="h-5 w-32 rounded bg-admin-surface-inset" />
        <div className="mt-4 space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="size-10 shrink-0 rounded-lg bg-admin-surface-inset" />
              <div className="h-8 flex-1 rounded bg-admin-surface-inset" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
