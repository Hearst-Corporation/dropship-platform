import { Hero, Offer, Benefits, Proof, FAQ, FinalCTA } from '@/components/storefront/blocks';
import type { StorefrontTemplateProps } from '../template-data';

/**
 * pet-home-practical — practical, offer-forward, warm. Order: split hero →
 * OFFER right after the hero (price-led, conversion-first) → benefits →
 * proof → FAQ → CTA. Less cinematic than the tech/beauty templates: the
 * value prop is usefulness + price, so the offer card comes early.
 */
export function PetHomePractical({ data }: StorefrontTemplateProps) {
  const d = data;
  return (
    <>
      <Hero variant="split" {...d.hero} ctaLabel="Voir l'offre" ctaHref="#offre" />
      <Offer
        kicker="L'offre"
        title="Tout ce qu'il faut, en une commande"
        priceLabel={d.priceLabel}
        included={d.included.length ? d.included : [{ qty: '1', label: d.product?.title ?? 'Le produit' }]}
        ctaLabel="Ajouter au panier"
        ctaHref="/cart"
        note="Expédition 24 h · Retours 30 jours"
      />
      <Benefits kicker="Pourquoi l'adopter" title="Pratique au quotidien" items={d.benefits} />
      <Proof kicker="Ils l'utilisent" promises={d.promises} lifestyleImages={d.lifestyleImages} />
      <FAQ
        items={[
          { q: 'Facile à utiliser au quotidien ?', a: 'Oui, pensé pour la maison et un usage simple.' },
          { q: 'Livraison et retours ?', a: 'Expédition sous 24 h, retours acceptés 30 jours.' },
        ]}
      />
      <FinalCTA
        headline={d.finalCta.headline}
        lede={d.finalCta.lede}
        ctaLabel={`Commander · ${d.priceLabel}`}
        ctaHref="/cart"
      />
    </>
  );
}
