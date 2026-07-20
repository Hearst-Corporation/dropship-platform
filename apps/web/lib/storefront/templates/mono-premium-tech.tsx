import { Hero, Benefits, Specs, Comparison, Proof, Offer, FAQ, FinalCTA } from '@/components/storefront/blocks';
import type { StorefrontTemplateProps } from '../template-data';

/**
 * mono-premium-tech — dense, specs-driven, premium-tech.
 * Order: split hero → benefits → dark spec sheet → comparison → proof →
 * offer → FAQ → accent CTA. Image used as a clean product shot.
 */
export function MonoPremiumTech({ data }: StorefrontTemplateProps) {
  const d = data;
  const comparisonRows = d.benefits.slice(0, 4).map((b) => ({ label: b.title, us: true, them: false }));
  return (
    <>
      <Hero variant="split" {...d.hero} ctaLabel={`Commander · ${d.priceLabel}`} ctaHref={d.ctaHref} />
      <Benefits kicker="Ce qui fait la différence" title="Pensé pour l'usage réel" items={d.benefits} />
      <Specs kicker="Fiche technique" specs={d.specs} />
      {comparisonRows.length > 0 && (
        <Comparison ours={d.store.name} theirs="Modèle générique" rows={comparisonRows} />
      )}
      <Proof
        kicker="Avis & garanties"
        promises={d.promises}
        lifestyleImages={d.lifestyleImages}
        ratingLabel={undefined}
      />
      <Offer
        kicker="Offre"
        priceLabel={d.priceLabel}
        included={d.included}
        ctaLabel="Ajouter au panier"
        ctaHref="/cart"
        note="Paiement sécurisé · Expédition suivie · Retours 30 jours"
      />
      <FAQ
        items={[
          { q: 'Quels sont les délais de livraison ?', a: 'Commande traitée sous 24 h, livraison suivie.' },
          { q: 'Puis-je retourner le produit ?', a: 'Oui, retours acceptés sous 30 jours.' },
          { q: 'La garantie est-elle incluse ?', a: 'Chaque commande est couverte par notre service après-vente.' },
        ]}
      />
      <FinalCTA
        kicker={d.finalCta.kicker}
        headline={d.finalCta.headline}
        lede={d.finalCta.lede}
        ctaLabel={`Commander · ${d.priceLabel}`}
        ctaHref="/cart"
      />
    </>
  );
}
