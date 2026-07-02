// Skeleton de chargement — reflète la mise en page de settings/page.tsx
// (header, puis 4 sections AdminSection empilées).
export default function Loading() {
  return (
    <div className="animate-pulse space-y-8" aria-hidden="true">
      {/* Header */}
      <div className="min-w-0 space-y-2">
        <div className="h-3 w-20 rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="h-7 w-64 rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="h-4 w-96 max-w-full rounded bg-zinc-100 dark:bg-zinc-800/60" />
      </div>

      {/* 4 sections de réglages */}
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border border-zinc-950/10 dark:border-white/10"
        >
          <div className="space-y-2 border-b border-zinc-950/10 px-5 py-4 sm:px-6 dark:border-white/10">
            <div className="h-5 w-48 rounded bg-zinc-200 dark:bg-zinc-800" />
            <div className="h-3 w-80 max-w-full rounded bg-zinc-100 dark:bg-zinc-800/60" />
          </div>
          <div className="space-y-4 p-5 sm:p-6">
            <div className="h-9 w-full max-w-sm rounded-lg bg-zinc-100 dark:bg-zinc-800/60" />
            <div className="h-9 w-32 rounded-lg bg-zinc-200 dark:bg-zinc-800" />
          </div>
        </div>
      ))}
    </div>
  );
}
