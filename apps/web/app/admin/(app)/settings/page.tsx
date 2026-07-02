import type { ReactNode } from 'react';
import { ArrowTopRightOnSquareIcon } from '@heroicons/react/16/solid';
import { getDbRead } from '@/lib/db';
import { Text, TextLink, Strong, Code } from '@/components/catalyst/text';
import { AdminBadge } from '@/components/admin/AdminBadge';
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

      <ProviderSection
        name="AliExpress DS API"
        meta="AppKey 531346 · App Category: Drop Shipping"
        badge={<AdminBadge status={aliStatus}>{aliLabel}</AdminBadge>}
        first
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
              <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2 2xl:grid-cols-3">
                <Field label="Compte" value={aliNick?.value || '–'} />
                <Field
                  label="Expire le"
                  value={
                    expiresAt ? (
                      <span className="inline-flex flex-wrap items-center gap-2">
                        <span className="font-medium text-zinc-950 dark:text-white">
                          {fmtDate(expiresAt)}
                        </span>
                        {isExpired && <Badge color="zinc">Expiré</Badge>}
                      </span>
                    ) : (
                      '–'
                    )
                  }
                />
                <Field
                  label="Dernière auth"
                  value={aliToken?.updatedAt ? fmtDate(aliToken.updatedAt) : '–'}
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

      <ProviderSection
        name="CJ Dropshipping API"
        meta="Email: adriennejkovic@gmail.com"
        badge={<AdminBadge status="missing-key">API Key manquante</AdminBadge>}
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
            <Subheading level={3}>{name}</Subheading>
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

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-xs/5 text-zinc-500 dark:text-zinc-400">{label}</dt>
      <dd className="text-sm text-zinc-950 dark:text-white">{value}</dd>
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

// Short visible labels for the table chips (full label stays in the title).
const CAPABILITY_SHORT: Record<string, string> = {
  unitOrder: 'Unitaire',
  noStock: 'No-stock',
  directShip: 'Direct',
  neutralPackaging: 'Neutre',
  stockPriceSync: 'Sync',
  tracking: 'Tracking',
  returns: 'Retours',
  imageRights: 'Images',
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
      {satisfied.map((key) => (
        <Badge key={key} color="zinc" title={CAPABILITY_LABELS[key]}>
          {CAPABILITY_SHORT[key]}
        </Badge>
      ))}
    </div>
  );
}

function SupplierPolicyTable({ rows }: { rows: SupplierPolicyRow[] }) {
  if (!rows.length) {
    return (
      <div className="p-6">
        <AdminEmptyState
          title="Aucun fournisseur"
          description="La politique fournisseurs est vide."
          action={
            <Button href="/api/aliexpress/oauth/start" color="indigo">
              Connecter AliExpress
            </Button>
          }
        />
      </div>
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
    <AdminDataTable minWidth="min-w-[44rem]" bare>
      <Table dense>
        <TableHead>
          <TableRow>
            <TableHeader>Fournisseur</TableHeader>
            <TableHeader>Statut</TableHeader>
            <TableHeader>Connexion</TableHeader>
            <TableHeader>Capacités</TableHeader>
          </TableRow>
        </TableHead>
        <TableBody className="[&>tr:last-child>td]:border-b-0">
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
                    {row.tier && <Badge color="zinc">{row.tier}</Badge>}
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
                  {row.connectionState === 'unknown' ? (
                    <span className="text-zinc-400 dark:text-zinc-600">–</span>
                  ) : (
                    <Badge color={cMeta.color}>{cMeta.label}</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <CapabilityChips capabilities={row.capabilities} hasData={hasCapabilities} />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </AdminDataTable>
  );
}
