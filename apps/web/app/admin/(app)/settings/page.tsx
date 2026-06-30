import type { ReactNode } from 'react';
import { getDbRead } from '@/lib/db';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { AdminBadge, type AdminBadgeColor } from '@/components/admin/AdminBadge';

export const dynamic = 'force-dynamic';

async function getSettings() {
  const db = getDbRead();
  const { rows } = await db.query<{ key: string; value: string; updated_at: Date }>(
    `SELECT key, value, updated_at FROM platform_settings ORDER BY key`,
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

  const aliToken = settings['aliexpress_access_token'];
  const aliNick = settings['aliexpress_user_nick'];
  const aliExpires = settings['aliexpress_token_expires'];

  const isConnected = !!aliToken?.value;
  const expiresAt = aliExpires?.value ? new Date(parseInt(aliExpires.value)) : null;
  const isExpired = expiresAt ? Date.now() > expiresAt.getTime() : false;

  const aliColor: AdminBadgeColor = isConnected && !isExpired ? 'green' : isConnected ? 'amber' : 'zinc';
  const aliLabel = isConnected && !isExpired ? 'Connecté' : isConnected ? 'Token expiré' : 'Non connecté';

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Production · Intégrations"
        title="Connexions fournisseurs"
        description="L'agent a besoin de ces clés pour interroger AliExpress et CJ. Les jetons OAuth expirent — vérifie l'état avant chaque grosse session."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ProviderCard
          name="AliExpress DS API"
          meta="AppKey 531346 · App Category: Drop Shipping"
          badge={<AdminBadge color={aliColor}>{aliLabel}</AdminBadge>}
        >
          {isConnected ? (
            <dl className="space-y-3">
              {aliNick?.value && <DLRow label="Compte" value={aliNick.value} />}
              {expiresAt && (
                <DLRow
                  label="Expire le"
                  value={<span className={isExpired ? 'text-zinc-400' : 'text-zinc-900'}>{fmtDate(expiresAt)}</span>}
                />
              )}
              {aliToken?.updatedAt && <DLRow label="Dernière auth" value={fmtDate(aliToken.updatedAt)} />}
            </dl>
          ) : (
            <p className="text-sm leading-6 text-zinc-500">
              L&apos;agent a besoin d&apos;un <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-xs text-zinc-700">access_token</code> OAuth
              pour appeler <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-xs text-zinc-700">aliexpress.solution.product.list.get</code>.
              Autorise l&apos;accès avec ton compte AliExpress.
            </p>
          )}
          <div className="pt-2">
            <a
              href="/api/aliexpress/oauth/start"
              className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
            >
              {isConnected && !isExpired ? 'Re-autoriser AliExpress' : 'Connecter AliExpress'}
              <span aria-hidden>↗</span>
            </a>
          </div>
        </ProviderCard>

        <ProviderCard
          name="CJ Dropshipping API"
          meta="Email: adriennejkovic@gmail.com"
          badge={<AdminBadge color="zinc">API Key manquante</AdminBadge>}
        >
          <p className="text-sm leading-6 text-zinc-500">
            L&apos;authentification CJ nécessite une <strong className="font-semibold text-zinc-900">API Key dédiée</strong> (pas le mot de passe du compte).
            Va sur{' '}
            <a href="https://cjdropshipping.com" target="_blank" rel="noreferrer" className="font-medium text-indigo-600 underline underline-offset-2 hover:text-indigo-500">
              cjdropshipping.com
            </a>{' '}
            &#8594; Account Settings &#8594; Developer &#8594; copie l&apos;API Key et mets-la dans{' '}
            <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-xs text-zinc-700">CJ_DROPSHIPPING_API_KEY</code>.
          </p>
        </ProviderCard>
      </div>
    </div>
  );
}

function DLRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-400">{label}</dt>
      <dd className="mt-0.5 text-sm text-zinc-900">{value}</dd>
    </div>
  );
}

function ProviderCard({
  name,
  meta,
  badge,
  children,
}: {
  name: string;
  meta: string;
  badge: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-zinc-200">
      <div className="flex items-center gap-3 border-b border-zinc-100 px-5 py-4">
        <span className="h-9 w-1 shrink-0 rounded-full bg-indigo-600" aria-hidden />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-zinc-900">{name}</h3>
          <p className="truncate text-xs text-zinc-400">{meta}</p>
        </div>
        <div className="shrink-0">{badge}</div>
      </div>
      <div className="space-y-3 px-5 py-4">{children}</div>
    </section>
  );
}
