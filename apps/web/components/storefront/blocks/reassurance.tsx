import { Section, Eyebrow } from './shared';

/**
 * Reassurance — bandeau de réassurance (livraison, retours, paiement sécurisé,
 * SAV). Texte GÉNÉRIQUE et factuel, aucun logo de marque tierce, aucune
 * allégation. Utilisé quand le template veut une rangée de confiance dédiée en
 * plus de la preuve sociale.
 */
export interface ReassuranceItem {
  title: string;
  body: string;
}
export interface ReassuranceProps {
  kicker?: string;
  items: ReassuranceItem[];
  tone?: 'plain' | 'muted';
}

/** Réassurance factuelle par défaut (jamais de claim, jamais de logo). */
export const DEFAULT_REASSURANCE: ReassuranceItem[] = [
  { title: 'Expédition suivie', body: 'Commande traitée sous 24 h, numéro de suivi fourni.' },
  { title: 'Retours 30 jours', body: 'Pas convaincu ? Retour accepté sous 30 jours.' },
  { title: 'Paiement sécurisé', body: 'Transaction chiffrée, aucune donnée de carte stockée.' },
  { title: 'Service client', body: 'Une question ? Notre équipe répond rapidement.' },
];

export function Reassurance({ kicker, items, tone = 'plain' }: ReassuranceProps) {
  const list = items?.length ? items : DEFAULT_REASSURANCE;
  return (
    <Section tint={tone}>
      {kicker && <Eyebrow>{kicker}</Eyebrow>}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {list.slice(0, 4).map((it, i) => (
          <div key={i} className="rounded-2xl border border-zinc-950/8 bg-white p-6">
            <h3 className="text-sm font-semibold text-zinc-950">{it.title}</h3>
            <p className="mt-1.5 text-sm/relaxed text-zinc-600">{it.body}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}
