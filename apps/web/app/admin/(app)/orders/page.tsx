import { medusa } from '@/lib/medusa';
import { getDbRead } from '@/lib/db';
import { ForwardButton } from './ForwardButton';
import { DryRunPendingButton } from './DryRunPendingButton';
import { MarkPaidButton } from './MarkPaidButton';
import { formatMoney } from '@/lib/medusa-store';
import { aliExpressOrderUrl } from '@/lib/suppliers/aliexpress';
import { Heading, Subheading } from '@/components/catalyst/heading';
import { Text, TextLink, Strong } from '@/components/catalyst/text';
import { Badge } from '@/components/catalyst/badge';
import { Table, TableHead, TableBody, TableRow, TableHeader, TableCell } from '@/components/catalyst/table';
import { DescriptionTerm, DescriptionDetails } from '@/components/catalyst/description-list';
import { AdminBadge } from '@/components/admin/AdminBadge';
import { AdminDataTable } from '@/components/admin/AdminDataTable';
import { ArrowTopRightOnSquareIcon } from '@heroicons/react/20/solid';

export const dynamic = 'force-dynamic';

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
      `SELECT medusa_order_id, supplier, supplier_order_id, status, dry_run,
              error_message, paid_at, created_at
         FROM dropship_order_forwards
        WHERE medusa_order_id IN (${placeholders})
          AND supplier_order_id IS NOT NULL
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
    { label: 'Commandes payées', value: String(stats.paidOrders) },
    { label: 'À payer chez AE', value: String(stats.awaitingPayment) },
    { label: 'Payées fournisseur', value: String(stats.paidAtSupplier) },
    { label: 'Erreurs forward', value: String(stats.errors) },
  ];

  return (
    <div className="flex min-w-0 flex-1 flex-col space-y-8">
      <div className="flex min-w-0 flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <Heading>Carnet de commandes</Heading>
          <Text>
            Forward chaque commande payée vers le fournisseur. Le dry-run sauve le payload sans rien envoyer.
          </Text>
        </div>
        <DryRunPendingButton />
      </div>

      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className="min-w-0 border-t border-zinc-950/10 pt-4 dark:border-white/10"
          >
            <DescriptionTerm>{kpi.label}</DescriptionTerm>
            <DescriptionDetails>
              <Strong className="text-2xl/8 tabular-nums">{kpi.value}</Strong>
            </DescriptionDetails>
          </div>
        ))}
      </dl>

      {fetchError && (
        <Text className="font-medium text-zinc-950 dark:text-white">Erreur Medusa : {fetchError}</Text>
      )}

      {awaitingPayment.length > 0 && (
        <div className="min-w-0 border-t border-zinc-950/10 pt-8 dark:border-white/10">
          <div className="flex items-baseline gap-2">
            <Subheading>À payer chez AliExpress</Subheading>
            <Badge color="zinc">
              {awaitingPayment.length} commande{awaitingPayment.length > 1 ? 's' : ''}
            </Badge>
          </div>
          <Text className="mt-1">
            AE n&apos;a pas d&apos;API de paiement. Ouvre le lien, paie sur aliexpress.com, puis clique{' '}
            <Strong>Marquer payée</Strong>. Annulation auto après <Strong>20 jours</Strong>.
          </Text>
          <AdminDataTable minWidth="min-w-[40rem]" className="mt-4">
            <Table dense>
              <TableHead>
                <TableRow>
                  <TableHeader>Commande</TableHeader>
                  <TableHeader>Client</TableHeader>
                  <TableHeader className="text-right">Total</TableHeader>
                  <TableHeader>Statut</TableHeader>
                  <TableHeader className="text-right">Action</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {awaitingPayment.map((row) => {
                  const ageMs = Date.now() - new Date(row.forwarded_at).getTime();
                  const ageHours = Math.floor(ageMs / 3_600_000);
                  const ageLabel =
                    ageHours < 1 ? '< 1 h' : ageHours < 48 ? `${ageHours} h` : `${Math.floor(ageHours / 24)} j`;
                  const stale = ageHours >= 24 * 15;
                  return (
                    <TableRow key={row.medusa_order_id}>
                      <TableCell>
                        <div className="font-medium text-zinc-950 dark:text-white">
                          #{row.display_id ?? row.medusa_order_id.slice(0, 8)}
                        </div>
                        <TextLink
                          href={aliExpressOrderUrl(row.supplier_order_id)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-0.5 inline-flex items-center gap-1 font-mono text-xs"
                        >
                          AE {row.supplier_order_id}
                          <ArrowTopRightOnSquareIcon className="h-3 w-3" aria-hidden="true" />
                        </TextLink>
                      </TableCell>
                      <TableCell className="max-w-40 truncate text-zinc-500">
                        {row.customer_email ?? '—'}
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums text-zinc-950 dark:text-white">
                        {row.total_minor != null && row.currency_code
                          ? formatMoney(row.total_minor, row.currency_code)
                          : '—'}
                      </TableCell>
                      <TableCell>
                        <Badge color="zinc">il y a {ageLabel}</Badge>
                        {stale && <Text className="mt-1 text-xs">proche annulation</Text>}
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
        </div>
      )}

      {!fetchError && orders.length === 0 && (
        <div className="min-w-0 border-t border-zinc-950/10 pt-8 dark:border-white/10">
          <Subheading>Aucune commande pour le moment.</Subheading>
          <Text className="mt-1">
            Les commandes Medusa payées apparaîtront ici dès qu&apos;un client passera commande.
          </Text>
        </div>
      )}

      {orders.length > 0 && (
        <div className="min-w-0 border-t border-zinc-950/10 pt-8 dark:border-white/10">
          <div className="flex items-baseline gap-2">
            <Subheading>Toutes les commandes</Subheading>
            <Badge color="zinc">
              {orders.length} affichée{orders.length > 1 ? 's' : ''}
            </Badge>
          </div>
          <AdminDataTable minWidth="min-w-[40rem]" className="mt-4">
            <Table dense>
              <TableHead>
                <TableRow>
                  <TableHeader>Commande</TableHeader>
                  <TableHeader>Client</TableHeader>
                  <TableHeader className="text-right">Total</TableHeader>
                  <TableHeader>Paiement / Statut</TableHeader>
                  <TableHeader className="text-right">Action</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {orders.map((order) => {
                  const legs = forwardsByOrder.get(order.id) ?? [];
                  // Consider "sent" if any leg has status=sent.
                  const sent = legs.some((f) => f.status === 'sent');
                  const paymentOk =
                    order.payment_status === 'captured' || order.payment_status === 'authorized';
                  const paymentLabel = order.payment_status ?? order.status ?? '—';
                  // Single-accent: paid states (captured/authorized) read as the
                  // accent ('active' -> indigo); every other state stays zinc,
                  // disambiguated by its label text.
                  const paymentBadgeStatus = paymentOk ? 'active' : 'unknown';
                  return (
                    <TableRow key={order.id}>
                      <TableCell>
                        <div className="font-medium text-zinc-950 dark:text-white">
                          #{order.display_id ?? order.id.slice(0, 8)}
                        </div>
                        <div className="mt-0.5 text-xs text-zinc-500">
                          {new Date(order.created_at).toLocaleDateString('fr-FR', {
                            day: '2-digit', month: 'short', year: 'numeric',
                          })}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-40 truncate text-zinc-500">
                          {order.email ?? '—'}
                        </div>
                        {order.shipping_address?.city && (
                          <div className="mt-0.5 text-xs text-zinc-500">{order.shipping_address.city}</div>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums text-zinc-950 dark:text-white">
                        {formatMoney(order.total, order.currency_code)}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col items-start gap-1">
                          <AdminBadge status={paymentBadgeStatus}>{paymentLabel}</AdminBadge>
                          {legs.length > 0 && (
                            <div className="flex flex-col items-start gap-1">
                              {legs.map((leg, legIdx) => {
                                if (leg.status === 'sent' && leg.supplier_order_id) {
                                  if (leg.supplier === 'aliexpress') {
                                    return (
                                      <div key={legIdx} className="flex items-center gap-1.5">
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
                                    <div key={legIdx} className="flex items-center gap-1.5">
                                      <Badge color="zinc">envoyée</Badge>
                                      <span className="font-mono text-xs text-zinc-500">
                                        {leg.supplier} #{leg.supplier_order_id}
                                      </span>
                                    </div>
                                  );
                                }
                                if (leg.status === 'dry_run') {
                                  return (
                                    <Badge key={legIdx} color="zinc">
                                      dry-run prêt ({leg.supplier})
                                    </Badge>
                                  );
                                }
                                // error
                                return (
                                  <div key={legIdx} className="flex max-w-52 flex-col items-start gap-1">
                                    <Badge color="zinc">erreur ({leg.supplier})</Badge>
                                    {leg.error_message && (
                                      <Text className="line-clamp-2 text-xs" title={leg.error_message}>
                                        {leg.error_message}
                                      </Text>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
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
        </div>
      )}
    </div>
  );
}
