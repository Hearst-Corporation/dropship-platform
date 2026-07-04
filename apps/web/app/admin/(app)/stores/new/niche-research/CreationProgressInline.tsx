import { Button } from '@/components/catalyst/button';
import { adminBgInset, adminBgPanel, adminBorder, adminText, adminTextMuted } from '@/components/admin/admin-surface';
import { cn } from '@/lib/utils/cn';
import type { CreationProgress } from './types';

/**
 * Inline progress card rendered inside the chat scroll area while the
 * parent's create-store SSE stream is alive. Three modes:
 *   - running → live spinner, current step, progress bar, step log
 *   - result  → success banner with "Ouvrir le store" CTA
 *   - error   → red banner with the error message
 */
export function CreationProgressInline({ progress }: { progress: CreationProgress }) {
  const { running, percent, elapsed, currentStep, logs, result, error, storeName } = progress;

  if (result) {
    return (
      <div className="flex justify-start">
        <div className="max-w-[88%] rounded-2xl rounded-tl-md border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-sm">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" aria-hidden />
            <span className={cn("font-medium", adminText)}>
              {result.storeName} est en ligne
            </span>
          </div>
          <p className={cn("text-xs mb-3", adminTextMuted)}>
            {result.productCount} produit{result.productCount > 1 ? 's' : ''} importé
            {result.productCount > 1 ? 's' : ''} · prêt à vendre
          </p>
          <Button href={`/shop/${result.slug}`} target="_blank" color="indigo">
            Ouvrir le store →
          </Button>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-start">
        <div className="max-w-[88%] rounded-2xl rounded-tl-md border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-red-500" aria-hidden />
            <span className={cn("font-medium", adminText)}>Création interrompue</span>
          </div>
          <p className={cn("text-xs whitespace-pre-wrap", adminTextMuted)}>{error}</p>
        </div>
      </div>
    );
  }

  if (!running) return null;

  const recentLogs = logs.slice(-8);

  return (
    <div className="flex justify-start">
      <div className={cn("max-w-[88%] w-full rounded-2xl rounded-tl-md border px-4 py-3 text-sm", adminBorder, adminBgPanel)}>
        <div className="flex items-center gap-2 mb-2">
          <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" aria-hidden />
          <span className={cn("font-medium truncate", adminText)}>
            Création de {storeName || '…'}
          </span>
          <span className={cn("ml-auto text-[11px] tabular-nums shrink-0", adminTextMuted)}>
            {percent}% · {elapsed}s
          </span>
        </div>
        {currentStep && (
          <p className={cn("text-xs italic mb-2 truncate", adminTextMuted)} title={currentStep}>
            {currentStep}
          </p>
        )}
        <div className={cn("h-1 w-full rounded-full overflow-hidden", adminBgInset)}>
          <div
            className="h-full bg-indigo-500 transition-all duration-300"
            style={{ width: `${Math.max(2, Math.min(100, percent))}%` }}
            aria-hidden
          />
        </div>
        {recentLogs.length > 0 && (
          <ul className={cn("mt-3 space-y-1 text-[11px] max-h-32 overflow-y-auto pr-1", adminTextMuted)}>
            {recentLogs.map((l) => (
              <li key={l.id} className="flex items-start gap-2">
                <span className="mt-px shrink-0">·</span>
                <span className="break-words">{l.message}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
