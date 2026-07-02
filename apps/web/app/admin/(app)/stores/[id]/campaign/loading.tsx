import clsx from "clsx";
import { adminKpiSkeleton, adminKpiStrip } from "@/components/admin/admin-surface";

export default function Loading() {
  return (
    <div className="animate-pulse space-y-8" aria-hidden="true">
      <div className="h-5 w-48 rounded bg-admin-surface-inset" />

      <div className={clsx(adminKpiStrip, "sm:grid-cols-2")}>
        <div className={clsx("h-24", adminKpiSkeleton)} />
      </div>

      <div className={clsx(adminKpiStrip, "sm:grid-cols-3")}>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className={clsx("h-24", adminKpiSkeleton)} />
        ))}
      </div>

      <div className={clsx(adminKpiStrip, "sm:grid-cols-2 xl:grid-cols-3")}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className={clsx("h-24", adminKpiSkeleton)} />
        ))}
      </div>

      <div className="h-64 rounded-xl border border-admin-border bg-admin-surface-inset" />
    </div>
  );
}
