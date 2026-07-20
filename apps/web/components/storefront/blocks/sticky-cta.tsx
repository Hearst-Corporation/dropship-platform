import { formatPrice } from './shared';

/**
 * StickyCta — barre CTA collée en bas, MOBILE UNIQUEMENT (`sm:hidden`). Améliore
 * fortement la conversion mobile sur les landings mono-produit. Zéro JS : c'est
 * un simple lien fixé. Le padding de fin de page est géré par le renderer.
 */
export interface StickyCtaProps {
  label: string;
  href: string;
  priceCents?: number | null;
  priceLabel?: string;
}
export function StickyCta({ label, href, priceCents, priceLabel }: StickyCtaProps) {
  const price = priceLabel ?? (typeof priceCents === 'number' ? formatPrice(priceCents) : undefined);
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-950/10 bg-white/95 px-4 py-3 backdrop-blur sm:hidden">
      <div className="flex items-center justify-between gap-3">
        {price && <span className="text-base font-semibold text-zinc-950">{price}</span>}
        <a
          href={href}
          className="inline-flex flex-1 items-center justify-center rounded-full bg-accent-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-accent-700"
        >
          {label}
        </a>
      </div>
    </div>
  );
}
