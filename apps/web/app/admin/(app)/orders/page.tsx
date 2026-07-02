import { medusa } from '@/lib/medusa';
import { getDbRead } from '@/lib/db';
import { ForwardButton } from './ForwardButton';
import { DryRunPendingButton } from './DryRunPendingButton';
import { MarkPaidButton } from './MarkPaidButton';
import { formatMoney } from '@/lib/medusa-store';
import { aliExpressOrderUrl } from '@/lib/suppliers/aliexpress';
import { Subheading } from '@/components/catalyst/heading';
import { Text, TextLink, Strong } from '@/components/catalyst/text';
import { Badge } from '@/components/catalyst/badge';
import { Table, TableHead, TableBody, TableRow, TableHeader, TableCell } from '@/components/catalyst/table';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { AdminSection } from '@/components/admin/AdminSection';
import { AdminStatCard } from '@/components/admin/AdminStatCard';
import { AdminStatsGrid } from '@/components/admin/AdminStatsGrid';
import { AdminBadge } from '@/components/admin/AdminBadge';
import { AdminDataTable } from '@/components/admin/AdminDataTable';
import {
  CheckCircleIcon,
  ClockIcon,
  TruckIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { ArrowTopRightOnSquareIcon } from '@heroicons/react/20/solid';

export const dynamic = 'force-dynamic';

/** Libellés FR pour les payment_status Medusa (bruts en anglais). */
const PAYMENT_LABEL_FR: Record<string, string> = {
  captured: 'Capturé',
  authorized: 'Autorisé',
  awaiting: 'En attente',
  not_paid: 'Non payé',
  canceled: 'Annulé',
  refunded: 'Remboursé',
  partially_refunded: 'Part. remboursé',
  requires_action: 'Action requise',
};

/** One forward leg per row in dropship_order_forwards. */
interface ForwardSummary {
  medusa_order_id: string;
  supplier: string;
  supplier_order_id: string | null;
  status: string;
  dry_run: boolean;
  error_message: string | null;
  paid_at: string | null;
  created_at: string;
}

interface AwaitingPaymentRow {
  medusa_order_id: string;
  supplier_order_id: string;
  forwarded_at: string;
  customer_email: string | null;
  total_minor: number | null;
  currency_code: string | null;
  display_id: number | null;
}

export default async function OrdersPage() {
  // 3 queries indépendantes en parallèle au lieu de séquentiel.
  // - medusa.getOrders : appel HTTP Medusa (le plus lent)
  // - awaitingRaw : DB read query — AliExpress rows awaiting payment
  const [ordersResult, awaitingResult] = await Promise.all([
    medusa.getOrders({ limit: 50 }).catch((e) => ({ error: e instanceof Error ? e.message : 'Unknown error', orders: [] as Awaited<ReturnType<typeof medusa.getOrders>>['orders'] })),
    getDbRead().query<{ medusa_order_id: string; supplier_order_id: string; created_at: string }>(
      `SELECT medusa_order_id, supplier_order_id, created_at
         FROM dropship_order_forwards
        WHERE status = 'sent' AND dry_run = false AND paid_at IS NULL
          AND supplier = 'aliexpress' AND supplier_order_id IS NOT NULL
        ORDER BY created_at ASC`,
    ),
  ]);

  const orders = ordersResult.orders;
  const fetchError = 'error' in ordersResult ? ordersResult.error : null;
  const awaitingRaw = awaitingResult.rows;

  const ids = orders.map((o) => o.id);
  // Map<medusa_order_id, ForwardSummary[]> — one array per order, one entry per supplier leg.
  const forwardsByOrder = new Map<string, ForwardSummary[]>();
  if (ids.length > 0) {
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ');
    const { rows } = await getDbRead().query<ForwardSummary>(
      // No supplier_order_id filter here: order-forwarder.ts only fills it on
      // status='sent', so filtering on it would hide every error/dry_run/sending
      // leg (and zero out the "Erreurs forward" KPI).
      `SELECT medusa_order_id, supplier, supplier_order_id, status, dry_run,
              error_message, paid_at, created_at
         FROM dropship_order_forwards
        WHERE medusa_order_id IN (${placeholders})
        ORDER BY medusa_order_id, created_at DESC`,
      ids,
    );
    for (const row of rows) {
      const existing = forwardsByOrder.get(row.medusa_order_id);
      if (existing) {
        existing.push(row);
      } else {
        forwardsByOrder.set(row.medusa_order_id, [row]);
      }
    }
  }

  // Hydrate with Medusa info for orders that scrolled off the limit-50 window.
  // Best-effort: a missing Medusa order shouldn't break the page.
  const ordersById = new Map(orders.map((o) => [o.id, o]));
  // Cap hydration at 20 orders: this only backfills the "à payer chez AE" table
  // display fields (email/total). Each id is one Medusa HTTP call, so an
  // unbounded map could fan out to hundreds of requests and stall the page.
  // Rows beyond the bound still render, just with the '—' fallbacks.
  const missingIds = awaitingRaw
    .map((r) => r.medusa_order_id)
    .filter((id) => !ordersById.has(id))
    .slice(0, 20);
  const fetched = await Promise.all(missingIds.map((id) => medusa.getOrder(id).catch(() => null)));
  for (const o of fetched) {
    if (o) ordersById.set(o.id, o);
  }

  const awaitingPayment: AwaitingPaymentRow[] = awaitingRaw.map((r) => {
    const o = ordersById.get(r.medusa_order_id);
    return {
      medusa_order_id: r.medusa_order_id,
      supplier_order_id: r.supplier_order_id,
      forwarded_at: r.created_at,
      customer_email: o?.email ?? null,
      total_minor: o?.total ?? null,
      currency_code: o?.currency_code ?? null,
      display_id: o?.display_id ?? null,
    };
  });

  // Flatten all forward legs for aggregate stats.
  const allLegs = Array.from(forwardsByOrder.values()).flat();

  const stats = {
    paidOrders: orders.filter(
      (o) => o.payment_status === 'captured' || o.payment_status === 'authorized',
    ).length,
    awaitingPayment: awaitingPayment.length,
    paidAtSupplier: allLegs.filter((f) => f.status === 'sent' && f.paid_at).length,
    errors: allLegs.filter((f) => f.status === 'error').length,
  };

  const kpis = [
    { label: 'Commandes payées', value: String(stats.paidOrders), icon: CheckCircleIcon },
    { label: 'À payer chez AE', value: String(stats.awaitingPayment), icon: ClockIcon },
    { label: 'Payées fournisseur', value: String(stats.paidAtSupplier), icon: TruckIcon },
    { label: 'Erreurs forward', value: String(stats.errors), icon: ExclamationTriangleIcon },
  ];

  return (
    <div className="flex min-w-0 flex-1 flex-col space-y-8">
      <AdminPageHeader
        title="Carnet de commandes"
        subtitle="Forward chaque commande payée vers le fournisseur. Le dry-run sauve le payload sans rien envoyer."
        actions={<DryRunPendingButton />}
      />

      <AdminStatsGrid cols={4}>
        {kpis.map((kpi) => (
          <AdminStatCard key={kpi.label} label={kpi.label} value={kpi.value} icon={kpi.icon} />
        ))}
      </AdminStatsGrid>

      {fetchError && <Text>Erreur Medusa : {fetchError}</Text>}

      {awaitingPayment.length > 0 && (
        <AdminSection
          title="À payer chez AliExpress"
          actions={
            <Badge color="zinc">
              {awaitingPayment.length} commande{awaitingPayment.length > 1 ? 's' : ''}
            </Badge>
          }
          flush
        >
          <div className="px-6 py-4 sm:px-8">
            <Text>
              AE n&apos;a pas d&apos;API de paiement. Ouvre le lien, paie sur aliexpress.com, puis clique{' '}
              <Strong>Marquer payée</Strong>. Annulation auto après <Strong>20 jours</Strong>.
            </Text>
          </div>
          <AdminDataTable>
            <Table dense>
              <TableHead>
                <TableRow>
                  <TableHeader>Commande</TableHeader>
                  <TableHeader className="hidden sm:table-cell">Client</TableHeader>
                  <TableHeader>Total</TableHeader>
                  <TableHeader className="hidden lg:table-cell">Order AE</TableHeader>
                  <TableHeader className="hidden md:table-cell">Forwardée</TableHeader>
                  <TableHeader className="text-right">Action</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody className="[&>tr:last-child>td]:border-b-0">
                {awaitingPayment.map((row) => {
                  const ageMs = Date.now() - new Date(row.forwarded_at).getTime();
                  const ageHours = Math.floor(ageMs / 3_600_000);
                  const ageLabel =
                    ageHours < 1 ? '< 1 h' : ageHours < 48 ? `${ageHours} h` : `${Math.floor(ageHours / 24)} j`;
                  const stale = ageHours >= 24 * 15;
                  return (
                    <TableRow key={row.medusa_order_id}>
                      <TableCell>
                        <div className="font-medium text-white">
                          #{row.display_id ?? row.medusa_order_id.slice(0, 8)}
                        </div>
                        <div className="mt-0.5 max-w-36 truncate font-mono text-xs text-zinc-500">
                          {row.medusa_order_id}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-40 truncate text-zinc-500 hidden sm:table-cell">
                        {row.customer_email ?? '—'}
                      </TableCell>
                      <TableCell className="font-semibold tabular-nums text-white">
                        {row.total_minor != null && row.currency_code
                          ? formatMoney(row.total_minor, row.currency_code)
                          : '—'}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <TextLink
                          href={aliExpressOrderUrl(row.supplier_order_id)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 font-mono text-xs"
                        >
                          {row.supplier_order_id}
                          <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" aria-hidden="true" />
                        </TextLink>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Badge color="zinc">il y a {ageLabel}</Badge>
                        {stale && (
                          <Text className="mt-1 text-xs">proche annulation</Text>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <MarkPaidButton orderId={row.medusa_order_id} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </AdminDataTable>
        </AdminSection>
      )}

      {!fetchError && orders.length === 0 && (
        <AdminSection title="Aucune commande pour le moment.">
          <Text>
            Les commandes Medusa payées apparaîtront ici dès qu&apos;un client passera commande.
          </Text>
        </AdminSection>
      )}

      {orders.length > 0 && (
        <AdminSection
          title="Toutes les commandes"
          actions={
            <Badge color="zinc">
              {orders.length} affichée{orders.length > 1 ? 's' : ''}
            </Badge>
          }
          flush
        >
          <AdminDataTable>
            <Table dense>
              <TableHead>
                <TableRow>
                  <TableHeader>Commande</TableHeader>
                  <TableHeader className="hidden sm:table-cell">Client</TableHeader>
                  <TableHeader>Total</TableHeader>
                  <TableHeader className="hidden md:table-cell">Paiement</TableHeader>
                  <TableHeader className="hidden lg:table-cell">Fournisseur(s)</TableHeader>
                  <TableHeader className="text-right">Action</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody className="[&>tr:last-child>td]:border-b-0">
                {orders.map((order) => {
                  const legs = forwardsByOrder.get(order.id) ?? [];
                  // Consider "sent" if any leg has status=sent.
                  const sent = legs.some((f) => f.status === 'sent');
                  return (
                    <TableRow key={order.id}>
                      <TableCell>
                        <div className="font-medium text-white">
                          #{order.display_id ?? order.id.slice(0, 8)}
                        </div>
                        <div className="mt-0.5 text-xs text-zinc-500">
                          {new Date(order.created_at).toLocaleDateString('fr-FR', {
                            day: '2-digit', month: 'short', year: 'numeric',
                          })}
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <div className="max-w-40 truncate text-zinc-500">
                          {order.email ?? '—'}
                        </div>
                        {order.shipping_address?.city && (
                          <div className="mt-0.5 text-xs text-zinc-500">{order.shipping_address.city}</div>
                        )}
                      </TableCell>
                      <TableCell className="font-semibold tabular-nums text-white">
                        {formatMoney(order.total, order.currency_code)}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <AdminBadge status={order.payment_status ?? order.status ?? 'pending'}>
                          {order.payment_status ?? order.status ?? '—'}
                        </AdminBadge>
                      </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <div className="flex flex-col items-start gap-1">
                            {legs.length === 0 ? (
                              <Text>—</Text>
                            ) : (
                              legs.map((leg, legIdx) => {
                                if (leg.status === 'sent' && leg.supplier_order_id) {
                                  if (leg.supplier === 'aliexpress') {
                                    return (
                                      <div key={legIdx} className="flex flex-col items-start gap-0.5">
                                        <AdminBadge status={leg.paid_at ? 'paid' : 'pending'}>
                                          {leg.paid_at ? 'payée' : 'à payer'}
                                        </AdminBadge>
                                        <TextLink
                                          href={aliExpressOrderUrl(leg.supplier_order_id)}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="font-mono text-xs"
                                        >
                                          AE {leg.supplier_order_id}
                                        </TextLink>
                                      </div>
                                    );
                                  }
                                  return (
                                    <div key={legIdx} className="flex flex-col items-start gap-0.5">
                                      <AdminBadge status="sent">envoyée</AdminBadge>
                                      <span className="font-mono text-xs text-zinc-500">
                                        {leg.supplier} #{leg.supplier_order_id}
                                      </span>
                                    </div>
                                  );
                                }
                                if (leg.status === 'dry_run') {
                                  return (
                                    <AdminBadge key={legIdx} status="ready">
                                      dry-run prêt ({leg.supplier})
                                    </AdminBadge>
                                  );
                                }
                                // error
                                return (
                                  <div key={legIdx} className="flex max-w-52 flex-col items-start gap-1">
                                    <AdminBadge status="error">erreur ({leg.supplier})</AdminBadge>
                                    {leg.error_message && (
                                      <Text className="line-clamp-2 text-xs" title={leg.error_message}>
                                        {leg.error_message}
                                      </Text>
                                    )}
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end">
                            <ForwardButton orderId={order.id} alreadySent={sent} />
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </AdminDataTable>
        </AdminSection>
      )}
    </div>
  );
}
