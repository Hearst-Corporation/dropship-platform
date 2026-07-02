import clsx from "clsx";
import { adminKpiSkeleton, adminKpiStrip } from "@/components/admin/admin-surface";

/**
 * Global admin loading state: a pulse skeleton mirroring the common page
 * anatomy (page header, KPI strip, table rows) so navigation between
 * sections never flashes an empty screen.
 */
export default function Loading() {
  return (
    <div className="animate-pulse space-y-8">
      <div className="space-y-2">
        <div className="h-8 w-56 rounded-lg bg-admin-surface-inset" />
        <div className="h-4 w-80 rounded bg-admin-surface-inset" />
      </div>
      <div
        className={clsx(
          adminKpiStrip,
          "sm:grid-cols-2 2xl:grid-cols-4",
        )}
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={clsx("h-24", adminKpiSkeleton)} />
        ))}
      </div>
      <div className="space-y-2 rounded-xl border border-admin-border p-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-10 rounded-md bg-admin-surface-inset" />
        ))}
      </div>
    </div>
  );
}
