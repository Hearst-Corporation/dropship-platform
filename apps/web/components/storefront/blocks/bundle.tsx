import Image from 'next/image';
import { Section, Eyebrow, Headline, CtaButton } from './shared';

/**
 * Bundle — mini-collection : plusieurs produits présentés comme un pack.
 * Rend null avec moins de 2 produits (un bundle mono n'a pas de sens). Chaque
 * carte est un vrai produit de la boutique (data.products), jamais un mock.
 */
export interface BundleProduct {
  title: string;
  priceLabel: string;
  imageUrl?: string | null;
}
export interface BundleProps {
  kicker?: string;
  title?: string;
  products: BundleProduct[];
  ctaLabel: string;
  ctaHref: string;
  note?: string;
}
export function Bundle({ kicker, title = 'Composez votre pack', products, ctaLabel, ctaHref, note }: BundleProps) {
  if (!products || products.length < 2) return null;
  return (
    <Section tint="muted">
      {kicker && <Eyebrow>{kicker}</Eyebrow>}
      <Headline>{title}</Headline>
      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {products.slice(0, 6).map((p, i) => (
          <div key={i} className="flex flex-col overflow-hidden rounded-2xl border border-zinc-950/8 bg-white">
            <div className="relative aspect-square w-full bg-zinc-100">
              {p.imageUrl ? (
                <Image src={p.imageUrl} alt="" fill sizes="(min-width:1024px) 30vw, 50vw" className="object-cover" />
              ) : (
                <div className="absolute inset-0 grid place-items-center text-3xl text-zinc-300">◇</div>
              )}
            </div>
            <div className="flex flex-1 flex-col gap-1 p-4">
              <h3 className="line-clamp-2 text-sm font-semibold text-zinc-950">{p.title}</h3>
              <span className="mt-auto pt-2 text-sm font-semibold text-accent-700">{p.priceLabel}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-8 flex flex-wrap items-center gap-4">
        <CtaButton href={ctaHref}>{ctaLabel}</CtaButton>
        {note && <span className="text-sm text-zinc-500">{note}</span>}
      </div>
    </Section>
  );
}
