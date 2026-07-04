import { useMemo, useState } from 'react';
import {
  MetaLibraryRenderer,
  PerplexityRenderer,
  SupplierRenderer,
  WebSearchRenderer,
} from './renderers';
import { ShortlistCard } from './ShortlistCard';
import type { ChatMessage, ShortlistPayload } from './types';
import { adminBgInset, adminBorder, adminBorderSoft, adminTextMuted } from '@/components/admin/admin-surface';
import { cn } from '@/lib/utils/cn';

interface ResearchToolCardProps {
  message: ChatMessage;
  onApplyShortlist: (payload: ShortlistPayload) => void;
}

export function ResearchToolCard({ message, onApplyShortlist }: ResearchToolCardProps) {
  const [open, setOpen] = useState(true);
  const isError = message.is_error;
  const name = message.tool_name || 'tool';

  // Stringify on every render is expensive when the chat scroll mounts many
  // tool cards — memoize per message so re-renders of the parent (streaming
  // ticks, cost updates) don't re-stringify potentially large payloads.
  const inputJson = useMemo(
    () => JSON.stringify(message.tool_input ?? {}, null, 2),
    [message.tool_input],
  );
  const outputJson = useMemo(
    () => JSON.stringify(message.tool_output ?? {}, null, 2),
    [message.tool_output],
  );

  // The shortlist card is a special-case: it doesn't get the collapsible
  // shell, it's a prominent CTA.
  if (name === 'shortlist_niche' && message.shortlist) {
    return <ShortlistCard payload={message.shortlist} onApply={onApplyShortlist} />;
  }

  return (
    <div
      className={cn(
        "rounded-xl border text-sm overflow-hidden",
        isError ? "border-red-500/40 bg-red-500/5" : cn(adminBorder, adminBgInset),
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full px-4 py-2 flex items-center gap-2 text-left transition-colors"
      >
        <span
          className={cn(
            "inline-block w-1.5 h-1.5 rounded-full",
            isError ? "bg-red-500" : message.tool_output ? "bg-emerald-500" : "bg-zinc-500",
          )}
        />
        <code className={cn("font-mono text-xs", adminTextMuted)}>{name}</code>
        <span className={cn("ml-auto text-xs line-clamp-1", adminTextMuted)}>{message.content}</span>
        <span className={cn("text-xs", adminTextMuted)}>{open ? '▾' : '▸'}</span>
      </button>

      {open && message.tool_output != null && (
        <div className={cn("px-4 pb-4 pt-1 space-y-3 border-t", adminBorderSoft)}>
          {name === 'web_search' && <WebSearchRenderer output={message.tool_output} />}
          {name === 'ask_perplexity' && <PerplexityRenderer output={message.tool_output} />}
          {name === 'meta_ads_library' && <MetaLibraryRenderer output={message.tool_output} />}
          {(name === 'aliexpress_search' || name === 'cj_search' || name === 'zendrop_search') && (
            <SupplierRenderer
              output={message.tool_output}
              supplier={name === 'cj_search' ? 'cj' : name === 'zendrop_search' ? 'zendrop' : 'aliexpress'}
            />
          )}
          {/* search_ad_benchmarks has no dedicated renderer (added after
              these cards were first written) — it falls through to the raw
              JSON <details> below like any other unrecognized tool. */}
          <details className={cn("text-xs", adminTextMuted)}>
            <summary className="cursor-pointer">Détails techniques</summary>
            <div className="mt-2 space-y-2">
              <div>
                <div className={cn("text-[10px] font-semibold uppercase tracking-wide", adminTextMuted)}>input</div>
                <pre className={cn("mt-1 rounded p-2 overflow-x-auto font-mono text-xs whitespace-pre-wrap break-all max-w-full", adminBgInset)}>
                  {inputJson}
                </pre>
              </div>
              <div>
                <div className={cn("text-[10px] font-semibold uppercase tracking-wide", adminTextMuted)}>output</div>
                <pre className={cn("mt-1 rounded p-2 overflow-x-auto font-mono text-xs whitespace-pre-wrap break-all max-w-full", adminBgInset)}>
                  {outputJson}
                </pre>
              </div>
            </div>
          </details>
        </div>
      )}
    </div>
  );
}
