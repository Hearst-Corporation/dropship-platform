import clsx from 'clsx';
import Link from 'next/link';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { AdminSection } from '@/components/admin/AdminSection';
import { adminText, adminTextMuted, adminBorder, adminBgInset } from '@/components/admin/admin-surface';
import { Text } from '@/components/ui/text';
import { STOREFRONT_BLUEPRINTS } from '@/lib/storefront/blueprint-templates';
import {
  BLUEPRINT_ARCHETYPES,
  scoreBlueprint,
  blockSignature,
} from '@/lib/storefront/inspiration/blueprint';
import { SEED_SOURCES, seedSourceLooksClean } from '@/lib/storefront/inspiration/seed-sources';
import type { BlockType, TemplateBlueprint, ProductContext } from '@/lib/storefront/inspiration/types';

export const dynamic = 'force-dynamic';

const BLOCK_LABEL: Record<BlockType, string> = {
  hero: 'Hero',
  problem_solution: 'Problème→Solution',
  benefits: 'Bénéfices',
  showcase: 'Showcase',
  specs: 'Specs',
  comparison: 'Comparaison',
  proof: 'Preuve',
  transformation: 'Avant/Après',
  objections: 'Objections',
  reassurance: 'Réassurance',
  offer: 'Offre',
  bundle: 'Bundle',
  faq: 'FAQ',
  final_cta: 'CTA final',
  sticky_cta: 'CTA sticky',
};

function ctxFor(bp: TemplateBlueprint): ProductContext {
  return {
    physical: true,
    mode: bp.mode,
    niche: bp.niche,
    hasLifestyleImages: bp.imageRequirements.lifestyleMin > 0,
  };
}

function Chip({ children, tone = 'default' }: { children: React.ReactNode; tone?: 'default' | 'accent' | 'good' | 'warn' }) {
  const cls =
    tone === 'accent'
      ? 'bg-indigo-500/15 text-indigo-300 ring-indigo-500/30'
      : tone === 'good'
        ? 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30'
        : tone === 'warn'
          ? 'bg-amber-500/15 text-amber-300 ring-amber-500/30'
          : `${adminBgInset} ${adminTextMuted} ring-white/10`;
  return (
    <span className={clsx('inline-flex items-center rounded-md px-2 py-0.5 text-[0.7rem] font-medium ring-1', cls)}>
      {children}
    </span>
  );
}

export default function InspirationPage() {
  const allSeedClean = SEED_SOURCES.every(seedSourceLooksClean);

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Inspiration & blueprints"
        subtitle="Les sources externes servent à extraire des patterns structurels, jamais à copier des sites. Chaque template est un blueprint de blocs réels, sans HTML/CSS/texte/image importé."
      />

      {/* Bandeau conformité */}
      <AdminSection title="Conformité légale">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {(
            [
              ['Texte copié', 'aucun'],
              ['Image copiée', 'aucune'],
              ['Logo / marque', 'aucun'],
              ['Hotlink externe', 'aucun'],
            ] as const
          ).map(([k, v]) => (
            <div key={k} className={clsx('rounded-xl border p-4', adminBorder)}>
              <p className={clsx('text-xs', adminTextMuted)}>{k}</p>
              <p className="mt-1 flex items-center gap-2 text-sm font-semibold text-emerald-300">
                <span className="inline-block size-2 rounded-full bg-emerald-400" />
                {v}
              </p>
            </div>
          ))}
        </div>
        <Text className="mt-4 !text-xs">
          Vérifié par les tests <code>sanitize.test.ts</code>, <code>seed-sources.test.ts</code> et{' '}
          <code>blueprint-templates.test.ts</code> (no copied text/asset/logo).
        </Text>
      </AdminSection>

      {/* Templates storefront (blueprints concrets) */}
      <AdminSection
        title="Templates storefront"
        description="7 layouts structurellement distincts, rendus par BlueprintRenderer à partir des blocs réels."
        actions={<Link href="/admin/templates" className={clsx('text-xs', adminTextMuted)}>← Galerie templates</Link>}
      >
        <div className="grid gap-4 lg:grid-cols-2">
          {STOREFRONT_BLUEPRINTS.map((bp) => {
            const score = scoreBlueprint(bp, ctxFor(bp));
            return (
              <div key={bp.id} className={clsx('flex flex-col gap-3 rounded-2xl border p-5', adminBorder)}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className={clsx('text-sm font-semibold', adminText)}>{bp.name}</h3>
                    <p className={clsx('truncate text-xs', adminTextMuted)}>{bp.id}</p>
                  </div>
                  <Chip tone={score >= 70 ? 'good' : score >= 50 ? 'accent' : 'warn'}>Score e-commerce {score}/100</Chip>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  <Chip>{bp.niche}</Chip>
                  <Chip>mode {bp.mode}</Chip>
                  <Chip>hero {bp.heroStyle}</Chip>
                  <Chip>densité {bp.contentDensity}</Chip>
                  <Chip>offre {bp.offerStrategy}</Chip>
                  <Chip>preuve {bp.proofStrategy}</Chip>
                </div>

                <div>
                  <p className={clsx('mb-1.5 text-[0.7rem] uppercase tracking-wide', adminTextMuted)}>Ordre des blocs</p>
                  <div className="flex flex-wrap items-center gap-1">
                    {bp.blockOrder.map((s, i) => (
                      <span key={i} className="flex items-center gap-1">
                        <Chip tone={s.type === 'offer' || s.type === 'bundle' || s.type === 'final_cta' ? 'accent' : 'default'}>
                          {BLOCK_LABEL[s.type]}
                        </Chip>
                        {i < bp.blockOrder.length - 1 && <span className={clsx('text-[0.6rem]', adminTextMuted)}>›</span>}
                      </span>
                    ))}
                  </div>
                </div>

                {bp.qaRules.length > 0 && (
                  <ul className={clsx('mt-1 space-y-0.5 text-[0.72rem]', adminTextMuted)}>
                    {bp.qaRules.map((r, i) => (
                      <li key={i}>· {r}</li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </AdminSection>

      {/* Archétypes de blueprints */}
      <AdminSection
        title="Archétypes de blueprints"
        description="Recettes de mise en page premium dérivées de patterns sanitizés. Réutilisables pour générer de nouveaux templates."
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {BLUEPRINT_ARCHETYPES.map((a) => (
            <div key={a.id} className={clsx('rounded-xl border p-4', adminBorder)}>
              <h4 className={clsx('text-sm font-semibold', adminText)}>{a.name}</h4>
              <p className={clsx('mt-0.5 font-mono text-[0.68rem]', adminTextMuted)}>{blockSignature(a)}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                <Chip>{a.mode}</Chip>
                <Chip>offre {a.offerStrategy}</Chip>
                <Chip>preuve {a.proofStrategy}</Chip>
              </div>
            </div>
          ))}
        </div>
      </AdminSection>

      {/* Registry de sources */}
      <AdminSection
        title="Sources d'inspiration"
        description="Références de recherche uniquement. Usage autorisé = extraction de structure. Usage interdit = tout contenu."
        actions={<Chip tone={allSeedClean ? 'good' : 'warn'}>{allSeedClean ? 'aucun contenu copié' : 'à vérifier'}</Chip>}
        flush
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className={clsx('border-b text-xs', adminBorder, adminTextMuted)}>
                <th className="px-5 py-3 font-medium">Source</th>
                <th className="px-5 py-3 font-medium">Usage autorisé</th>
                <th className="px-5 py-3 font-medium">Usage interdit</th>
              </tr>
            </thead>
            <tbody>
              {SEED_SOURCES.map((s) => (
                <tr key={s.sourceType + s.hint} className={clsx('border-b align-top', adminBorder)}>
                  <td className="px-5 py-3">
                    <span className={clsx('text-sm font-medium', adminText)}>{s.sourceType}</span>
                    <span className={clsx('block text-xs', adminTextMuted)}>{s.hint}</span>
                  </td>
                  <td className={clsx('px-5 py-3 text-xs', adminTextMuted)}>{s.allowedUse}</td>
                  <td className="px-5 py-3 text-xs text-amber-300/80">{s.forbiddenUse}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AdminSection>
    </div>
  );
}
