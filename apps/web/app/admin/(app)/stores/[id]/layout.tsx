import { notFound } from 'next/navigation';
import { getDbRead } from '@/lib/db';
import { StoreLogo } from '@/components/ui';
import { AdminBadge } from '@/components/admin/AdminBadge';
import { Heading } from '@/components/catalyst/heading';
import { StoreTabsBar } from './_components/StoreTabsBar';
import { BreadcrumbBackLink } from './_components/BreadcrumbBackLink';

export const dynamic = 'force-dynamic';

/**
 * Store layout — dark admin:
 *   - Per-store nav rendered via StoreTabsBar (Tailwind dark tabs).
 *   - Breadcrumb kept (lightweight, context-useful).
 *   - Data fetch (store name/slug/status) preserved for breadcrumb + StoreTabsBar.
 */
export default async function StoreLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = getDbRead();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  const { rows } = await db.query<{ id: string; slug: string; name: string; logo_emoji: string; status: string }>(
    isUuid
      ? `SELECT id, slug, name, logo_emoji, status FROM dropship_stores WHERE id = $1 LIMIT 1`
      : `SELECT id, slug, name, logo_emoji, status FROM dropship_stores WHERE slug = $1 LIMIT 1`,
    [id],
  );
  const store = rows[0];
  if (!store) notFound();

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      {/* Breadcrumb */}
      <nav
        className="flex min-w-0 shrink-0 items-center gap-2 text-sm"
        aria-label="Fil d'Ariane"
      >
        <BreadcrumbBackLink />
        <span className="text-zinc-500" aria-hidden="true">/</span>
        <span className="inline-flex">
          <StoreLogo emoji={store.logo_emoji} size={16} />
        </span>
        <span className="min-w-0 truncate text-base/6 font-semibold text-zinc-950 dark:text-white">
          {store.name}
        </Heading>
        {store.status !== 'active' && (
          <AdminBadge status={store.status}>{store.status}</AdminBadge>
        )}
      </nav>

      <StoreTabsBar storeId={store.id} />

      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
