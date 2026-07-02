export default function Loading() {
  // Skeleton mirroring the preview layout: sticky admin header bar on top,
  // then a full-bleed storefront (hero + product grid placeholders).
  return (
    <div className="min-h-screen bg-admin-surface-inset">
      {/* Admin header bar */}
      <div className="sticky top-0 z-50 flex items-center gap-3 border-b border-admin-border-strong bg-admin-preview-chrome px-4 py-2.5">
        <div className="h-4 w-20 animate-pulse rounded bg-admin-surface-inset" />
        <div className="h-4 w-40 animate-pulse rounded bg-admin-surface-inset" />
        <div className="h-5 w-24 animate-pulse rounded bg-admin-surface-inset" />
        <div className="ml-auto h-5 w-44 animate-pulse rounded-full bg-admin-surface-inset" />
      </div>

      {/* Storefront hero */}
      <div className="aspect-[21/9] w-full animate-pulse bg-admin-surface-inset" />

      {/* Product grid */}
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="mb-8 space-y-3">
          <div className="h-8 w-80 animate-pulse rounded-md bg-admin-surface-inset" />
          <div className="h-4 w-96 animate-pulse rounded bg-admin-surface-inset" />
        </div>
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="space-y-2">
              <div className="aspect-square animate-pulse rounded-lg bg-admin-surface-inset" />
              <div className="h-4 w-3/4 animate-pulse rounded bg-admin-surface-inset" />
              <div className="h-4 w-16 animate-pulse rounded bg-admin-surface-inset" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
