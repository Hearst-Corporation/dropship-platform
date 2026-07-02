import type { ReactNode } from 'react';
import { getDbRead } from '@/lib/db';
import { Heading, Subheading } from '@/components/catalyst/heading';
import { Text, TextLink, Strong, Code } from '@/components/catalyst/text';
import { AdminBadge } from '@/components/admin/AdminBadge';
import { Badge } from '@/components/catalyst/badge';
import { Button } from '@/components/catalyst/button';
import { DescriptionList, DescriptionTerm, DescriptionDetails } from '@/components/catalyst/description-list';
import { getSupplierPolicyView, type SupplierPolicyRow } from '@/lib/suppliers/policy-view';

export const dynamic = 'force-dynamic';

async function getSettings() {
  const db = getDbRead();
  const { rows } = await db.query<{ key: string; value: string; updated_at: Date }>(
    `SELECT key, value, updated_at FROM platform_settings ORDER BY key LIMIT 200`,
  );
  return Object.fromEntries(rows.map((r) => [r.key, { value: r.value, updatedAt: r.updated_at }]));
}

function fmtDate(d: Date | number): string {
  return new Date(d).toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default async function SettingsPage() {
  const settings = await getSettings();
  const supplierRows = await getSupplierPolicyView();

  const aliToken = settings['aliexpress_access_token'];
  const aliNick = settings['aliexpress_user_nick'];
  const aliExpires = settings['aliexpress_token_expires'];

  const isConnected = !!aliToken?.value;
  const expiresAt = aliExpires?.value ? new Date(parseInt(aliExpires.value)) : null;
  const isExpired = expiresAt ? Date.now() > expiresAt.getTime() : false;

  const aliStatus = isConnected && !isExpired ? 'connected' : isConnected ? 'pending' : 'offline';
  const aliLabel = isConnected && !isExpired ? 'Connecté' : isConnected ? 'Token expiré' : 'Non connecté';

  return (
    <div className="space-y-8">
      <div>
        <Text className="text-xs/5 font-semibold uppercase tracking-wide text-zinc-500">
          Production · Intégrations
        </Text>
        <Heading>Connexions fournisseurs</Heading>
        <Text className="mt-2">
          L&apos;agent a besoin de ces clés pour interroger AliExpress et CJ. Les jetons OAuth expirent — vérifie
          l&apos;état avant chaque grosse session.
        </Text>
      </div>

      <ProviderSection
        name="AliExpress DS API"
        meta="AppKey 531346 · App Category: Drop Shipping"
        badge={<AdminBadge status={aliStatus}>{aliLabel}</AdminBadge>}
        first
      >
        {isConnected ? (
          <DescriptionList>
            {aliNick?.value && (
              <>
                <DescriptionTerm>Compte</DescriptionTerm>
                <DescriptionDetails>{aliNick.value}</DescriptionDetails>
              </>
            )}
            {expiresAt && (
              <>
                <DescriptionTerm>Expire le</DescriptionTerm>
                <DescriptionDetails>
                  <span className={isExpired ? 'text-zinc-500' : undefined}>{fmtDate(expiresAt)}</span>
                </DescriptionDetails>
              </>
            )}
            {aliToken?.updatedAt && (
              <>
                <DescriptionTerm>Dernière auth</DescriptionTerm>
                <DescriptionDetails>{fmtDate(aliToken.updatedAt)}</DescriptionDetails>
              </>
            )}
          </DescriptionList>
        ) : (
          <Text>
            L&apos;agent a besoin d&apos;un <Code>access_token</Code> OAuth pour appeler{' '}
            <Code>aliexpress.solution.product.list.get</Code>. Autorise l&apos;accès avec ton compte AliExpress.
          </Text>
        )}
        <div className="pt-2">
          <Button href="/api/aliexpress/oauth/start" color="indigo">
            {isConnected && !isExpired ? 'Re-autoriser AliExpress' : 'Connecter AliExpress'}
          </Button>
        </div>
      </ProviderSection>

      <ProviderSection
        name="CJ Dropshipping API"
        meta="Email: adriennejkovic@gmail.com"
        badge={<AdminBadge status="missing-key">API Key manquante</AdminBadge>}
      >
        <Text>
          L&apos;authentification CJ nécessite une <Strong>API Key dédiée</Strong> (pas le mot de passe du compte). Va
          sur <TextLink href="https://cjdropshipping.com" target="_blank" rel="noreferrer">cjdropshipping.com</TextLink>{' '}
          &#8594; Account Settings &#8594; Developer &#8594; copie l&apos;API Key et mets-la dans{' '}
          <Code>CJ_DROPSHIPPING_API_KEY</Code>.
        </Text>
      </ProviderSection>

      {/* ── Fournisseurs policy view ────────────────────────────────────── */}
      <div className="border-t border-zinc-950/10 pt-8 dark:border-white/10">
        <Text className="text-xs/5 font-semibold uppercase tracking-wide text-zinc-500">
          Politique dropshipping
        </Text>
        <Heading>Fournisseurs</Heading>
        <Text className="mt-2">
          Vue en lecture seule de tous les fournisseurs connus, classee par statut. Les criteres
          verts sont satisfaits ; les icones orange indiquent un critere manquant ou partiel.
        </Text>
      </div>

      <SupplierPolicySection rows={supplierRows} />
    </div>
  );
}

// ── Supplier policy view components ──────────────────────────────────────────

const CAPABILITY_LABELS: Record<string, string> = {
  unitOrder: 'Commande unitaire',
  noStock: 'No-stock',
  directShip: 'Expedition directe',
  neutralPackaging: 'Emballage neutre',
  stockPriceSync: 'Sync stock/prix',
  tracking: 'Tracking',
  returns: 'Retours',
  imageRights: 'Droits images',
};

const CAPABILITY_KEYS = Object.keys(CAPABILITY_LABELS);

function CapabilityIcon({ ok }: { ok: boolean }) {
  if (ok) {
    return (
      <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">
        <svg className="h-2.5 w-2.5" viewBox="0 0 10 10" fill="currentColor" aria-hidden="true">
          <path
            fillRule="evenodd"
            d="M8.485 2.07a.75.75 0 0 1 .045 1.06l-4.5 4.875a.75.75 0 0 1-1.097.015L.97 5.486A.75.75 0 0 1 2.03 4.514l1.47 1.572L7.424 2.116a.75.75 0 0 1 1.06-.045Z"
            clipRule="evenodd"
          />
        </svg>
      </span>
    );
  }
  return (
    <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
      <svg className="h-2.5 w-2.5" viewBox="0 0 10 10" fill="currentColor" aria-hidden="true">
        <path
          fillRule="evenodd"
          d="M5 1a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 5 1ZM5 8a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z"
          clipRule="evenodd"
        />
      </svg>
    </span>
  );
}

function ConnectionBadge({ state }: { state: string }) {
  const map: Record<string, { status: string; label: string }> = {
    connected: { status: 'connected', label: 'Connecté' },
    error: { status: 'error', label: 'Erreur' },
    'missing-key': { status: 'missing-key', label: 'Clé manquante' },
    unknown: { status: 'unknown', label: 'Inconnu' },
  };
  const { status, label } = map[state] ?? { status: state, label: state };
  return <AdminBadge status={status}>{label}</AdminBadge>;
}

function ActiveSupplierCard({ row }: { row: SupplierPolicyRow }) {
  const isLimitedSourcing = row.status === 'feed-only' || row.status === 'search_only';
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex min-w-0 items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-zinc-900 dark:text-white">{row.label}</span>
            {row.tier && (
              <Badge color="indigo">{row.tier}</Badge>
            )}
            <ConnectionBadge state={row.connectionState} />
          </div>
          {isLimitedSourcing && (
            <p className="mt-1 text-xs text-zinc-500">
              Sourcing seul - pas d auto-forward
            </p>
          )}
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-4">
        {CAPABILITY_KEYS.map((key) => (
          <div key={key} className="flex items-center gap-1.5">
            <CapabilityIcon ok={!!row.capabilities[key]} />
            <span className="text-xs text-zinc-600 dark:text-zinc-400">{CAPABILITY_LABELS[key]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AutomationCard({ row }: { row: SupplierPolicyRow }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <span className="text-sm font-semibold text-zinc-900 dark:text-white">{row.label}</span>
        </div>
        <Badge color="zinc">Automatisation</Badge>
      </div>
      <Text className="mt-1.5 text-xs text-zinc-500">
        Couche d automatisation - pas un fournisseur valide
      </Text>
    </div>
  );
}

function ExcludedRow({ row }: { row: SupplierPolicyRow }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-zinc-100 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900 sm:flex-row sm:items-start sm:gap-4">
      <div className="flex shrink-0 items-center gap-2">
        <Badge color="zinc">Exclu</Badge>
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{row.label}</span>
      </div>
      {row.exclusionNote && (
        <Text className="text-xs text-zinc-500">{row.exclusionNote}</Text>
      )}
    </div>
  );
}

function SupplierPolicySection({ rows }: { rows: SupplierPolicyRow[] }) {
  const activeSourcing = rows.filter(
    (r) => r.status === 'active' || r.status === 'feed-only' || r.status === 'search_only',
  );
  const automation = rows.filter((r) => r.status === 'automation');
  const excluded = rows.filter((r) => r.status === 'excluded');

  return (
    <div className="space-y-8">
      {/* Block 1 — Fournisseurs actifs */}
      {activeSourcing.length > 0 && (
        <div className="space-y-3">
          <Subheading>Fournisseurs actifs</Subheading>
          <div className="space-y-3">
            {activeSourcing.map((row) => (
              <ActiveSupplierCard key={row.id} row={row} />
            ))}
          </div>
        </div>
      )}

      {/* Block 2 — Automatisation */}
      {automation.length > 0 && (
        <div className="space-y-3 border-t border-zinc-950/10 pt-6 dark:border-white/10">
          <Subheading>Automatisation</Subheading>
          <div className="space-y-3">
            {automation.map((row) => (
              <AutomationCard key={row.id} row={row} />
            ))}
          </div>
        </div>
      )}

      {/* Block 3 — Plateformes exclues */}
      {excluded.length > 0 && (
        <div className="space-y-3 border-t border-zinc-950/10 pt-6 dark:border-white/10">
          <Subheading>Plateformes exclues</Subheading>
          <div className="space-y-2">
            {excluded.map((row) => (
              <ExcludedRow key={row.id} row={row} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Legacy OAuth provider cards ───────────────────────────────────────────────

function ProviderSection({
  name,
  meta,
  badge,
  first,
  children,
}: {
  name: string;
  meta: string;
  badge: ReactNode;
  first?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      className={
        first
          ? 'space-y-4'
          : 'space-y-4 border-t border-zinc-950/10 pt-8 dark:border-white/10'
      }
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="min-w-0 flex-1">
          <Subheading>{name}</Subheading>
          <Text className="text-xs/5">{meta}</Text>
        </div>
        <div className="shrink-0">{badge}</div>
      </div>
      {children}
    </section>
  );
}
