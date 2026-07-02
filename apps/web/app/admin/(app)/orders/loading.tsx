import clsx from "clsx";
import { adminKpiSkeleton, adminKpiStrip } from "@/components/admin/admin-surface";

/** Skeleton miroir de la page orders : heading + action, 4 KPI, table. */
export default function Loading() {
  return (
    <div className="flex min-w-0 flex-1 animate-pulse flex-col space-y-8">
      <div className="flex min-w-0 flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <div className="h-8 w-72 rounded-lg bg-admin-surface-muted" />
          <div className="h-4 w-96 max-w-full rounded bg-admin-surface-inset" />
        </div>
        <div className="h-9 w-52 rounded-lg bg-admin-surface-inset" />
      </div>

      <div className={clsx(adminKpiStrip, "sm:grid-cols-2 lg:grid-cols-4")}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={clsx("h-24", adminKpiSkeleton)} />
        ))}
      </div>

      <div className="rounded-xl border border-admin-border">
        <div className="space-y-3 p-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-9 rounded bg-admin-surface-inset" />
          ))}
        </div>
      </div>
    </div>
  );
}
