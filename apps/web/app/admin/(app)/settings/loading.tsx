// Skeleton de chargement — reflète la mise en page de settings/page.tsx
// (header + sections fournisseurs).
export default function Loading() {
  return (
    <div className="space-y-8 animate-pulse" aria-hidden="true">
      {/* Header */}
      <div className="space-y-2">
        <div className="h-3 w-48 rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="h-7 w-72 rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="h-4 w-full max-w-2xl rounded bg-zinc-100 dark:bg-zinc-800/60" />
      </div>

      {/* Sections fournisseurs */}
      {Array.from({ length: 3 }).map((_, i) => (
        <section
          key={i}
          className={
            i === 0
              ? 'space-y-4'
              : 'space-y-4 border-t border-zinc-950/10 pt-8 dark:border-white/10'
          }
        >
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-5 w-56 rounded bg-zinc-200 dark:bg-zinc-800" />
              <div className="h-3 w-64 rounded bg-zinc-100 dark:bg-zinc-800/60" />
            </div>
            <div className="h-5 w-24 shrink-0 rounded-full bg-zinc-200 dark:bg-zinc-800" />
          </div>
          <div className="h-4 w-full max-w-xl rounded bg-zinc-100 dark:bg-zinc-800/60" />
          <div className="h-9 w-48 rounded-lg bg-zinc-200 dark:bg-zinc-800" />
        </section>
      ))}
    </div>
  );
}
