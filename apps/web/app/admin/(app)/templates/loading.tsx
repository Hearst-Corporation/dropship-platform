export default function Loading() {
  // Skeleton mirroring the gallery layout: heading + intro, then register
  // sections each with a subheading and a grid of 16/10 preview cards.
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <div className="h-8 w-72 animate-pulse rounded-md bg-admin-surface-inset" />
        <div className="h-4 w-96 max-w-full animate-pulse rounded bg-admin-surface-inset" />
      </div>
      {[0, 1, 2].map((s) => (
        <div key={s} className="space-y-4">
          <div className="h-5 w-48 animate-pulse rounded bg-admin-surface-inset" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="overflow-hidden rounded-lg ring-1 ring-admin-ring"
              >
                <div className="aspect-[16/10] animate-pulse bg-admin-surface-inset" />
                <div className="space-y-2 p-4">
                  <div className="h-4 w-2/3 animate-pulse rounded bg-admin-surface-inset" />
                  <div className="h-3 w-full animate-pulse rounded bg-admin-surface-inset" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
