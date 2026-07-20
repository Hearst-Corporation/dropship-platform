import { Badge } from "@/components/ui/badge";
import { Text } from "@/components/ui/text";
import { adminBgInset, adminBorder, adminBorderSoft, adminText, adminTextMuted } from "@/components/admin/admin-surface";
import { cn } from "@/lib/utils/cn";

export function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-pulse" />
      <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-pulse [animation-delay:120ms]" />
      <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-pulse [animation-delay:240ms]" />
    </span>
  );
}

export function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className={cn("text-[10px] font-semibold uppercase tracking-wide", adminTextMuted)}>{label}</p>
      <p className={cn("mt-0.5 font-semibold tabular-nums", adminText)}>{value}</p>
    </div>
  );
}

// output shape matches lib/agent/research/executors.ts execWebSearch(), which
// wraps lib/research/tavily.ts's tavilySearch(): { query, topic, results }
// with results: { title, url, snippet, published? }[].
export function WebSearchRenderer({ output }: { output: unknown }) {
  const data = output as {
    query?: string;
    results?: Array<{ title: string; url: string; snippet: string; published?: string }>;
  };
  const results = data.results ?? [];
  if (results.length === 0) {
    return <Text className="!text-xs">Aucun résultat.</Text>;
  }
  return (
    <ul className="space-y-2">
      {results.map((r) => {
        let host = '';
        try {
          host = new URL(r.url).hostname.replace(/^www\./, '');
        } catch {
          host = r.url;
        }
        return (
          <li key={r.url} className={cn("rounded-lg border p-3", adminBorder, adminBgInset)}>
            <a
              href={r.url}
              target="_blank"
              rel="noreferrer noopener"
              className={cn("text-sm font-medium hover:underline line-clamp-2", adminText)}
            >
              {r.title || host}
            </a>
            <div className={cn("flex items-center gap-2 mt-0.5 text-xs", adminTextMuted)}>
              <span>{host}</span>
              {r.published && <span>· {new Date(r.published).toLocaleDateString('fr-FR')}</span>}
            </div>
            {r.snippet && <Text className="mt-1 !text-xs line-clamp-3">{r.snippet}</Text>}
          </li>
        );
      })}
    </ul>
  );
}

// output shape matches execAskPerplexity(): { query, answer, citations }
// (lib/research/perplexity.ts's PerplexityAnswer).
export function PerplexityRenderer({ output }: { output: unknown }) {
  const data = output as { query?: string; answer?: string; citations?: string[] };
  if (!data.answer) return <Text className="!text-xs">Réponse vide.</Text>;
  return (
    <div className="space-y-2">
      <blockquote className={cn("border-l-2 pl-3 text-sm whitespace-pre-wrap", adminBorder, adminTextMuted)}>
        {data.answer}
      </blockquote>
      {data.citations && data.citations.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {data.citations.map((c, i) => {
            let host = '';
            try {
              host = new URL(c).hostname.replace(/^www\./, '');
            } catch {
              host = c;
            }
            return (
              <a
                key={`${c}-${i}`}
                href={c}
                target="_blank"
                rel="noreferrer noopener"
                className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-xs", adminBorder, adminTextMuted)}
              >
                [{i + 1}] {host}
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}

// output shape matches execMetaAdsLibrary(), which returns the raw
// NicheValidationResult from lib/trends/meta-library.ts verbatim:
// { saturation, verdict, totalAds, topAdvertisers: {name, pageId?, adCount}[],
//   sampleCreatives: {adId?, advertiser, previewImage?, landingUrl?, startedAt?}[],
//   angles, source, rawSnippet? }.
export function MetaLibraryRenderer({ output }: { output: unknown }) {
  const data = output as {
    saturation?: number;
    verdict?: 'go' | 'caution' | 'no-go';
    totalAds?: number;
    topAdvertisers?: Array<{ name: string; adCount: number }>;
    sampleCreatives?: Array<{ advertiser: string; previewImage?: string }>;
    angles?: string[];
  };
  const sat = data.saturation ?? 0;
  const verdict = data.verdict ?? 'caution';
  const barColor =
    verdict === 'no-go' ? 'bg-red-500' : verdict === 'caution' ? 'bg-amber-500' : 'bg-emerald-500';
  const verdictBadgeColor = verdict === 'no-go' ? 'red' : verdict === 'caution' ? 'amber' : 'emerald';
  return (
    <div className="space-y-3">
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className={cn("text-xs font-medium", adminTextMuted)}>Saturation</span>
          <div className="flex items-center gap-1.5">
            <span className={cn("text-xs tabular-nums", adminTextMuted)}>{sat}/100</span>
            <Badge color={verdictBadgeColor}>{verdict.toUpperCase()}</Badge>
          </div>
        </div>
        <div className={cn("h-1.5 rounded-full overflow-hidden", adminBgInset)}>
          <div className={cn("h-full rounded-full", barColor)} style={{ width: `${sat}%` }} />
        </div>
      </div>
      {data.sampleCreatives && data.sampleCreatives.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {data.sampleCreatives.slice(0, 3).map((c, i) => (
            <div
              key={`${c.advertiser}-${i}`}
              className={cn("aspect-square rounded-md overflow-hidden border", adminBorder, adminBgInset)}
            >
              {c.previewImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.previewImage} alt={c.advertiser} className="w-full h-full object-cover" />
              ) : (
                <div className={cn("w-full h-full flex items-center justify-center text-[10px] text-center p-1", adminTextMuted)}>
                  {c.advertiser}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {data.topAdvertisers && data.topAdvertisers.length > 0 && (
        <ul className="space-y-1 text-xs">
          {data.topAdvertisers.slice(0, 3).map((a) => (
            <li key={a.name} className={cn("flex justify-between", adminTextMuted)}>
              <span className="truncate">{a.name}</span>
              <span className="tabular-nums shrink-0 ml-3">{a.adCount} ads</span>
            </li>
          ))}
        </ul>
      )}
      {data.angles && data.angles.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {data.angles.map((a) => (
            <span
              key={a}
              className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-xs", adminBorder, adminTextMuted)}
            >
              {a}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// output shape matches execSupplierSearch() in
// lib/agent/research/executors.ts: { query, candidates: [...], total_found }
// on success, or { query, candidates: [], error } on failure. candidates[]
// always include margin_cents (computed in the executor as
// suggested_price_cents - cost_cents), matching what this renderer expects.
export function SupplierRenderer({
  output,
  supplier,
}: {
  output: unknown;
  supplier: 'aliexpress' | 'cj' | 'zendrop';
}) {
  const data = output as {
    query?: string;
    candidates?: Array<{
      supplier_product_id: string;
      title: string;
      image_url: string;
      supplier_url: string;
      cost_cents: number;
      suggested_price_cents: number;
      margin_cents: number;
      orders?: number;
      rating?: string | null;
    }>;
    error?: string;
  };
  const candidates = data.candidates ?? [];
  if (candidates.length === 0) {
    return (
      <Text className="!text-xs">
        Aucun produit. {data.error && <span>{data.error}</span>}
      </Text>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-xs">
        <thead>
          <tr className={cn("text-left", adminTextMuted)}>
            <th className="font-medium py-1 pr-2">Produit</th>
            <th className="font-medium py-1 px-2 text-right">Coût</th>
            <th className="font-medium py-1 px-2 text-right">Prix</th>
            <th className="font-medium py-1 px-2 text-right">Marge</th>
            <th className="font-medium py-1 pl-2 text-right">Cmd</th>
          </tr>
        </thead>
        <tbody className={adminTextMuted}>
          {candidates.slice(0, 6).map((c) => (
            <tr key={c.supplier_product_id} className={cn("border-t", adminBorderSoft)}>
              <td className="py-1.5 pr-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className={cn("w-7 h-7 rounded shrink-0 overflow-hidden", adminBgInset)}>
                    {c.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.image_url} alt="" className="w-full h-full object-cover" />
                    ) : null}
                  </div>
                  <a
                    href={c.supplier_url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="shrink-0"
                  >
                    <Badge color={supplier === 'aliexpress' ? 'zinc' : 'indigo'}>{supplier}</Badge>
                  </a>
                  <span className="truncate">{c.title}</span>
                </div>
              </td>
              <td className="py-1.5 px-2 text-right tabular-nums">
                {(c.cost_cents / 100).toFixed(2)} €
              </td>
              <td className="py-1.5 px-2 text-right tabular-nums">
                {(c.suggested_price_cents / 100).toFixed(2)} €
              </td>
              <td className="py-1.5 px-2 text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                +{(c.margin_cents / 100).toFixed(2)} €
              </td>
              <td className="py-1.5 pl-2 text-right tabular-nums">
                {c.orders ?? 0}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
