import type { ReactNode } from 'react';
import { getDbRead } from '@/lib/db';
import { Heading, Subheading } from '@/components/catalyst/heading';
import { Text, TextLink, Strong, Code } from '@/components/catalyst/text';
import { Badge } from '@/components/catalyst/badge';
import { Button } from '@/components/catalyst/button';
import { DescriptionList, DescriptionTerm, DescriptionDetails } from '@/components/catalyst/description-list';

export const dynamic = 'force-dynamic';

type BadgeColor = 'zinc' | 'green' | 'amber' | 'red' | 'indigo' | 'blue';

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

  const aliToken = settings['aliexpress_access_token'];
  const aliNick = settings['aliexpress_user_nick'];
  const aliExpires = settings['aliexpress_token_expires'];

  const isConnected = !!aliToken?.value;
  const expiresAt = aliExpires?.value ? new Date(parseInt(aliExpires.value)) : null;
  const isExpired = expiresAt ? Date.now() > expiresAt.getTime() : false;

  const aliColor: BadgeColor = isConnected && !isExpired ? 'green' : isConnected ? 'amber' : 'zinc';
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
        badge={<Badge color={aliColor}>{aliLabel}</Badge>}
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

      <hr className="my-10 border-zinc-950/10 dark:border-white/10" />

      <ProviderSection
        name="CJ Dropshipping API"
        meta="Email: adriennejkovic@gmail.com"
        badge={<Badge color="zinc">API Key manquante</Badge>}
      >
        <Text>
          L&apos;authentification CJ nécessite une <Strong>API Key dédiée</Strong> (pas le mot de passe du compte). Va
          sur <TextLink href="https://cjdropshipping.com" target="_blank" rel="noreferrer">cjdropshipping.com</TextLink>{' '}
          &#8594; Account Settings &#8594; Developer &#8594; copie l&apos;API Key et mets-la dans{' '}
          <Code>CJ_DROPSHIPPING_API_KEY</Code>.
        </Text>
      </ProviderSection>
    </div>
  );
}

function ProviderSection({
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
    <section className="space-y-4">
      <div className="flex items-center gap-3">
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
