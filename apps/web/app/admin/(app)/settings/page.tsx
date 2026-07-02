import type { ReactNode } from 'react';
import { ArrowTopRightOnSquareIcon } from '@heroicons/react/16/solid';
import { getDbRead } from '@/lib/db';
import { Text, TextLink, Strong, Code } from '@/components/catalyst/text';
import { Badge } from '@/components/catalyst/badge';
import { Button } from '@/components/catalyst/button';
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeader,
  TableCell,
} from '@/components/catalyst/table';
import { getSupplierPolicyView, type SupplierPolicyRow } from '@/lib/suppliers/policy-view';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { AdminSection } from '@/components/admin/AdminSection';
import { AdminDataTable } from '@/components/admin/AdminDataTable';
import { AdminEmptyState } from '@/components/admin/AdminEmptyState';

export const dynamic = 'force-dynamic';

// Single accent (indigo) + neutral (zinc) only. Every non-positive state is zinc,
// disambiguated by its label text, never by hue.
type BadgeColor = 'zinc' | 'indigo';

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

  const aliColor: BadgeColor = isConnected && !isExpired ? 'indigo' : 'zinc';
  const aliLabel = isConnected && !isExpired ? 'Connecté' : isConnected ? 'Token expiré' : 'Non connecté';

  const cjEmail = (process.env.CJ_DROPSHIPPING_EMAIL || '').trim();
  const cjKeySet = !!(process.env.CJ_DROPSHIPPING_API_KEY || '').trim();
  const cjMeta = cjEmail ? `Compte : ${cjEmail}` : 'Compte non lié';
  const cjColor: BadgeColor = cjKeySet ? 'indigo' : 'zinc';
  const cjLabel = cjKeySet ? 'API Key configurée' : 'API Key manquante';

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Réglages"
        subtitle="Connexions fournisseurs et politique dropshipping de la plateforme."
        meta={
          <>
            <span>Production · Intégrations</span>
            <span aria-hidden="true">·</span>
            <span>{supplierRows.length} fournisseurs connus</span>
          </>
        }
      />

      {/* ── Identifiants fournisseurs ──────────────────────────────────────── */}
      <AdminSection
        title="Identifiants fournisseurs"
        description="L'agent a besoin de ces clés pour interroger AliExpress et CJ. Les jetons OAuth expirent, vérifie l'état avant chaque grosse session."
      >
        <div className="divide-y divide-zinc-950/10 dark:divide-white/10">
          <IntegrationRow
            name="AliExpress DS API"
            meta="AppKey 531346 · App Category: Drop Shipping"
            badge={<Badge color={aliColor}>{aliLabel}</Badge>}
            action={
              <Button href="/api/aliexpress/oauth/start" color="indigo">
                {isConnected && !isExpired ? 'Ré-autoriser' : 'Connecter'}
              </Button>
            }
          >
            {isConnected ? (
              <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-3">
                <Field label="Compte" value={aliNick?.value || '—'} />
                <Field
                  label="Expire le"
                  value={expiresAt ? fmtDate(expiresAt) : '—'}
                  muted={isExpired}
                />
                <Field
                  label="Dernière auth"
                  value={aliToken?.updatedAt ? fmtDate(aliToken.updatedAt) : '—'}
                />
              </dl>
            ) : (
              <Text className="text-sm">
                L&apos;agent a besoin d&apos;un <Code>access_token</Code> OAuth pour appeler{' '}
                <Code>aliexpress.solution.product.list.get</Code>. Autorise l&apos;accès avec ton compte
                AliExpress.
              </Text>
            )}
          </IntegrationRow>

          <IntegrationRow
            name="CJ Dropshipping API"
            meta={cjMeta}
            badge={<Badge color={cjColor}>{cjLabel}</Badge>}
            action={
              <Button href="https://cjdropshipping.com" target="_blank" outline>
                Ouvrir CJ
                <ArrowTopRightOnSquareIcon data-slot="icon" />
              </Button>
            }
          >
            <Text className="text-sm">
              L&apos;authentification CJ nécessite une <Strong>API Key dédiée</Strong> (pas le mot de
              passe du compte). Va sur{' '}
              <TextLink href="https://cjdropshipping.com" target="_blank" rel="noreferrer">
                cjdropshipping.com
              </TextLink>{' '}
              &#8594; Account Settings &#8594; Developer &#8594; copie l&apos;API Key et mets-la dans{' '}
              <Code>CJ_DROPSHIPPING_API_KEY</Code>.
            </Text>
          </IntegrationRow>
        </div>
      </AdminSection>

      {/* ── Politique dropshipping ─────────────────────────────────────────── */}
      <AdminSection
        title="Politique dropshipping"
        description="Vue en lecture seule de tous les fournisseurs connus, classée par statut. La colonne Capacités récapitule chaque critère : un point plein signale un critère satisfait, un point atténué un critère manquant ou partiel."
        flush
      >
        <SupplierPolicyTable rows={supplierRows} />
      </AdminSection>
    </div>
  );
}

// ── Integration row (identifiants) ───────────────────────────────────────────

function IntegrationRow({
  name,
  meta,
  badge,
  action,
  children,
}: {
  name: string;
  meta: string;
  badge: ReactNode;
  action: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="py-5 first:pt-0 last:pb-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-zinc-950 dark:text-white">{name}</h3>
            {badge}
          </div>
          <p className="mt-0.5 text-xs/5 text-zinc-500 dark:text-zinc-400">{meta}</p>
        </div>
        <div className="shrink-0">{action}</div>
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function Field({ label, value, muted }: { label: string; value: ReactNode; muted?: boolean }) {
  return (
    <div>
      <dt className="text-xs/5 text-zinc-500 dark:text-zinc-400">{label}</dt>
      <dd
        className={
          muted
            ? 'text-sm text-zinc-400 dark:text-zinc-500'
            : 'text-sm text-zinc-950 dark:text-white'
        }
      >
        {value}
      </dd>
    </div>
  );
}

// ── Supplier policy table ────────────────────────────────────────────────────

const CAPABILITY_LABELS: Record<string, string> = {
  unitOrder: 'Commande unitaire',
  noStock: 'No-stock',
  directShip: 'Expédition directe',
  neutralPackaging: 'Emballage neutre',
  stockPriceSync: 'Sync stock/prix',
  tracking: 'Tracking',
  returns: 'Retours',
  imageRights: 'Droits images',
};

const CAPABILITY_KEYS = Object.keys(CAPABILITY_LABELS);

// Only the "active" state carries the accent (indigo). Every other status is
// neutral zinc, disambiguated by its label text.
const STATUS_META: Record<string, { color: BadgeColor; label: string }> = {
  active: { color: 'indigo', label: 'Actif' },
  'feed-only': { color: 'zinc', label: 'Feed seul' },
  search_only: { color: 'zinc', label: 'Sourcing seul' },
  automation: { color: 'zinc', label: 'Automatisation' },
  excluded: { color: 'zinc', label: 'Exclu' },
};

function statusMeta(status: string): { color: BadgeColor; label: string } {
  return STATUS_META[status] ?? { color: 'zinc', label: status };
}

// Only "connected" carries the accent; error / missing-key / unknown are zinc.
const CONNECTION_META: Record<string, { color: BadgeColor; label: string }> = {
  connected: { color: 'indigo', label: 'Connecté' },
  error: { color: 'zinc', label: 'Erreur' },
  'missing-key': { color: 'zinc', label: 'Clé manquante' },
  unknown: { color: 'zinc', label: 'Inconnu' },
};

/**
 * Compact inline capability group. Renders one small dot per capability:
 * satisfied = filled accent (indigo) dot, missing/partial = faint zinc dot.
 * Each dot carries a native title tooltip ("Critère · Satisfait|Manquant").
 * Neutral palette only: indigo for present, zinc for absent.
 */
function CapabilityDots({
  capabilities,
  hasData,
}: {
  capabilities: Record<string, boolean>;
  hasData: boolean;
}) {
  if (!hasData) {
    return <span className="text-xs text-zinc-400 dark:text-zinc-600">—</span>;
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {CAPABILITY_KEYS.map((key) => {
        const ok = !!capabilities[key];
        const label = CAPABILITY_LABELS[key];
        return (
          <span
            key={key}
            title={`${label} · ${ok ? 'Satisfait' : 'Manquant ou partiel'}`}
            aria-label={`${label} : ${ok ? 'satisfait' : 'manquant ou partiel'}`}
            className={
              ok
                ? 'size-2 rounded-full bg-indigo-500 dark:bg-indigo-400'
                : 'size-2 rounded-full bg-zinc-300 dark:bg-zinc-700'
            }
          />
        );
      })}
    </div>
  );
}

function SupplierPolicyTable({ rows }: { rows: SupplierPolicyRow[] }) {
  if (!rows.length) {
    return (
      <div className="p-6">
        <AdminEmptyState title="Aucun fournisseur" description="La politique fournisseurs est vide." />
      </div>
    );
  }

  return (
    <AdminDataTable minWidth="min-w-[36rem]" className="border-0 bg-transparent dark:bg-transparent">
      <Table dense>
        <TableHead>
          <TableRow>
            <TableHeader>Fournisseur</TableHeader>
            <TableHeader>Statut</TableHeader>
            <TableHeader>Connexion</TableHeader>
            <TableHeader>Capacités</TableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => {
            const sMeta = statusMeta(row.status);
            const cMeta =
              CONNECTION_META[row.connectionState] ?? {
                color: 'zinc' as BadgeColor,
                label: row.connectionState,
              };
            const hasCapabilities = Object.keys(row.capabilities).length > 0;
            return (
              <TableRow key={row.id}>
                <TableCell>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-zinc-950 dark:text-white">{row.label}</span>
                    {row.tier && <Badge color="indigo">{row.tier}</Badge>}
                  </div>
                  {row.exclusionNote && (
                    <p className="mt-0.5 max-w-md text-xs text-zinc-500 dark:text-zinc-400">
                      {row.exclusionNote}
                    </p>
                  )}
                </TableCell>
                <TableCell>
                  <Badge color={sMeta.color}>{sMeta.label}</Badge>
                </TableCell>
                <TableCell>
                  <Badge color={cMeta.color}>{cMeta.label}</Badge>
                </TableCell>
                <TableCell>
                  <CapabilityDots capabilities={row.capabilities} hasData={hasCapabilities} />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </AdminDataTable>
  );
}
