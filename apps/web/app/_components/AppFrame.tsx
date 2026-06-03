'use client';
// WHY conditional: CockpitShell (admin chrome: RailLeft nav + RailRight SuperAgent + bordeaux bg)
// must only wrap /admin* routes. Storefront pages (/shop, /cart, /checkout, etc.) are
// independently themed and must NOT inherit the 3-column admin layout.
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { CockpitShell } from '@hearst/cockpit-shell';
import SuperAgentOverlayMobile from '@/components/super-agent/SuperAgentOverlayMobile';
import { MerchantBottomBar } from '@/components/cockpit/MerchantBottomBar';
import { createClientChatPersistence } from './cockpit-chat-persistence-client';

const MERCHANT_PRODUCTS = [
  { id: 'merchant' as const, name: 'Hearst Merchant', short: 'MR', color: '#F0567A' },
];

const chatConfig = { persistence: createClientChatPersistence() };

export default function AppFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith('/admin') ?? false;

  // CockpitShell (@hearst/cockpit-shell) does an internal client/server branch
  // on its bottom bar, so its SSR markup doesn't match the first client render
  // → hydration mismatch. The admin chrome is auth-gated and client-only by
  // nature, so we mount the shell after hydration: server + first client paint
  // both render the neutral dark container (they match), then the shell mounts.
  // Storefront routes are untouched and keep full SSR.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (isAdmin) {
    // Neutral dark container — also the anti-flash backdrop before .ct-root paints.
    const shell = (
      <div style={{ minHeight: '100dvh', background: 'var(--ct-bg-deep)' }}>
        {mounted && (
          <>
            <CockpitShell products={MERCHANT_PRODUCTS} appId="merchant" chatConfig={chatConfig}>
              {children}
            </CockpitShell>
            {/* Navigation centralisée admin — flottante en bas, uniquement /admin/* */}
            <MerchantBottomBar />
          </>
        )}
      </div>
    );
    return mounted ? (
      <>
        {shell}
        <SuperAgentOverlayMobile />
      </>
    ) : (
      shell
    );
  }
  return <>{children}</>;
}
