import clsx from "clsx";
import { adminKpiSkeleton, adminKpiStrip } from "@/components/admin/admin-surface";

// Skeleton de chargement — reflète la mise en page de page.tsx
export default function Loading() {
  return (
    <div className="animate-pulse space-y-8" aria-hidden="true">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <div className="h-3 w-20 rounded bg-admin-surface-inset" />
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-full bg-admin-surface-inset" />
            <div className="h-7 w-48 rounded bg-admin-surface-inset" />
          </div>
          <div className="h-4 w-72 rounded bg-admin-surface-inset" />
        </div>
        <div className="h-9 w-32 rounded-lg bg-admin-surface-inset" />
      </div>

      <div>
        <div className="h-5 w-28 rounded bg-admin-surface-inset" />
        <div className={clsx(adminKpiStrip, "mt-4 sm:grid-cols-2 xl:grid-cols-4")}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={clsx("h-24", adminKpiSkeleton)} />
          ))}
        </div>
      </div>

      <div className="border-t border-admin-border pt-8">
        <div className="flex items-start justify-between gap-4">
          <div className="h-5 w-32 rounded bg-admin-surface-inset" />
          <div className="h-5 w-16 rounded-md bg-admin-surface-inset" />
        </div>
        <div className="mt-4 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between gap-6">
              <div className="h-4 w-24 rounded bg-admin-surface-inset" />
              <div className="h-4 w-40 rounded bg-admin-surface-inset" />
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-admin-border pt-8">
        <div className="space-y-2">
          <div className="h-5 w-28 rounded bg-admin-surface-inset" />
          <div className="h-4 w-48 rounded bg-admin-surface-inset" />
        </div>
        <div className="h-9 w-40 rounded-lg bg-admin-surface-inset" />
      </div>
    </div>
  );
}
