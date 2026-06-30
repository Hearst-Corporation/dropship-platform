import { medusa } from '@/lib/medusa';
import { getDbRead } from '@/lib/db';
import { ForwardButton } from './ForwardButton';
import { DryRunPendingButton } from './DryRunPendingButton';
import { MarkPaidButton } from './MarkPaidButton';
import { formatMoney } from '@/lib/medusa-store';
import { aliExpressOrderUrl } from '@/lib/suppliers/aliexpress';
import { Heading, Subheading } from '@/components/catalyst/heading';
import { Text, Strong } from '@/components/catalyst/text';
import { Badge } from '@/components/catalyst/badge';
import { Table, TableHead, TableBody, TableRow, TableHeader, TableCell } from '@/components/catalyst/table';
import { ArrowTopRightOnSquareIcon } from '@heroicons/react/20/solid';

export const dynamic = 'force-dynamic';

interface ForwardSummary {
  medusa_order_id: string;
  status: string;
  ae_order_id: string | null;
  dry_run: boolean;
  error_message: string | null;
  paid_at: string | null;
  created_at: string;
}

interface AwaitingPaymentRow {
  medusa_order_id: string;
  ae_order_id: string;
  forwarded_at: string;
  customer_email: string | null;
  total_minor: number | null;
  currency_code: string | null;
  display_id: number | null;
}

export default async function OrdersPage() {
  // 3 queries indépendantes en parallèle au lieu de séquentiel.
  // - medusa.getOrders : appel HTTP Medusa (le plus lent)
  // - awaitingRaw : DB read query
  // (la query forwardsByOrder dépend de orders.id donc reste séquentielle après)
  const [ordersResult, awaitingResult] = await Promise.all([
    medusa.getOrders({ limit: 50 }).catch((e) => ({ error: e instanceof Error ? e.message : 'Unknown error', orders: [] as Awaited<ReturnType<typeof medusa.getOrders>>['orders'] })),
    getDbRead().query<{ medusa_order_id: string; ae_order_id: string; created_at: string }>(
      `SELECT medusa_order_id, ae_order_id, created_at
         FROM dropship_order_forwards
        WHERE status = 'sent' AND dry_run = false AND paid_at IS NULL
          AND ae_order_id IS NOT NULL
        ORDER BY created_at ASC`,
    ),
  ]);

  const orders = ordersResult.orders;
  const fetchError = 'error' in ordersResult ? ordersResult.error : null;
  const awaitingRaw = awaitingResult.rows;

  const ids = orders.map((o) => o.id);
  let forwardsByOrder = new Map<string, ForwardSummary>();
  if (ids.length > 0) {
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ');
    const { rows } = await getDbRead().query<ForwardSummary>(
      `SELECT DISTINCT ON (medusa_order_id)
              medusa_order_id, status, ae_order_id, dry_run, error_message, paid_at, created_at
         FROM dropship_order_forwards
        WHERE medusa_order_id IN (${placeholders})
        ORDER BY medusa_order_id, created_at DESC`,
      ids,
    );
    forwardsByOrder = new Map(rows.map((r) => [r.medusa_order_id, r]));
  }

  // Hydrate with Medusa info for orders that scrolled off the limit-50 window.
  // Best-effort: a missing Medusa order shouldn't break the page.
  const ordersById = new Map(orders.map((o) => [o.id, o]));
  const missingIds = awaitingRaw.map((r) => r.medusa_order_id).filter((id) => !ordersById.has(id));
  const fetched = await Promise.all(missingIds.map((id) => medusa.getOrder(id).catch(() => null)));
  for (const o of fetched) {
    if (o) ordersById.set(o.id, o);
  }

  const awaitingPayment: AwaitingPaymentRow[] = awaitingRaw.map((r) => {
    const o = ordersById.get(r.medusa_order_id);
    return {
      medusa_order_id: r.medusa_order_id,
      ae_order_id: r.ae_order_id,
      forwarded_at: r.created_at,
      customer_email: o?.email ?? null,
      total_minor: o?.total ?? null,
      currency_code: o?.currency_code ?? null,
      display_id: o?.display_id ?? null,
    };
  });

  const stats = {
    paidOrders: orders.filter(
      (o) => o.payment_status === 'captured' || o.payment_status === 'authorized',
    ).length,
    awaitingPayment: awaitingPayment.length,
    paidAtAe: Array.from(forwardsByOrder.values()).filter(
      (f) => f.status === 'sent' && f.paid_at,
    ).length,
    errors: Array.from(forwardsByOrder.values()).filter((f) => f.status === 'error').length,
  };

  const kpis = [
    { label: 'Commandes payées', value: String(stats.paidOrders) },
    { label: 'À payer chez AE', value: String(stats.awaitingPayment) },
    { label: 'Payées chez AE', value: String(stats.paidAtAe) },
    { label: 'Erreurs forward', value: String(stats.errors) },
  ];

  return (
    <div className="flex flex-1 flex-col space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Text className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            Production · Dropship
          </Text>
          <Heading>Carnet de commandes</Heading>
          <Text>
            Forward chaque commande payée vers AliExpress. Le dry-run sauve le payload sans rien envoyer.
          </Text>
        </div>
        <DryRunPendingButton />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-lg bg-white p-6 ring-1 ring-zinc-950/5 dark:bg-zinc-900 dark:ring-white/10"
          >
            <Text>{kpi.label}</Text>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-zinc-950 dark:text-white">
              {kpi.value}
            </p>
          </div>
        ))}
      </div>

      {fetchError && (
        <div className="rounded-lg bg-red-500/10 px-4 py-3 ring-1 ring-red-500/20">
          <Text className="text-red-600 dark:text-red-400">Erreur Medusa : {fetchError}</Text>
        </div>
      )}

      {awaitingPayment.length > 0 && (
        <div className="rounded-lg bg-white p-6 ring-1 ring-zinc-950/5 dark:bg-zinc-900 dark:ring-white/10">
          <div className="flex items-baseline gap-2">
            <Subheading>À payer chez AliExpress</Subheading>
            <Text className="text-xs uppercase tracking-wider text-zinc-500">
              · {awaitingPayment.length} commande{awaitingPayment.length > 1 ? 's' : ''}
            </Text>
          </div>
          <Text className="mt-1">
            AE n&apos;a pas d&apos;API de paiement. Ouvre le lien, paie sur aliexpress.com, puis clique{' '}
            <Strong>Marquer payée</Strong>. Annulation auto après <Strong>20 jours</Strong>.
          </Text>
          <Table className="mt-4">
            <TableHead>
              <TableRow>
                <TableHeader>Commande</TableHeader>
                <TableHeader>Client</TableHeader>
                <TableHeader>Total</TableHeader>
                <TableHeader>Order AE</TableHeader>
                <TableHeader>Forwardée</TableHeader>
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
                      <div className="mt-0.5 max-w-[140px] truncate font-mono text-xs text-zinc-500">
                        {row.medusa_order_id}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[160px] truncate text-zinc-500">
                      {row.customer_email ?? '—'}
                    </TableCell>
                    <TableCell className="font-semibold tabular-nums text-zinc-950 dark:text-white">
                      {row.total_minor != null && row.currency_code
                        ? formatMoney(row.total_minor, row.currency_code)
                        : '—'}
                    </TableCell>
                    <TableCell>
                      <a
                        href={aliExpressOrderUrl(row.ae_order_id)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-mono text-xs text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300"
                      >
                        {row.ae_order_id}
                        <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" aria-hidden="true" />
                      </a>
                    </TableCell>
                    <TableCell>
                      <Badge color={stale ? 'amber' : 'zinc'}>il y a {ageLabel}</Badge>
                      {stale && (
                        <div className="mt-1 text-xs font-medium text-indigo-600 dark:text-indigo-400">
                          proche annulation
                        </div>
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
        </div>
      )}

      {!fetchError && orders.length === 0 && (
        <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-zinc-950/10 bg-white px-6 py-12 text-center dark:border-white/10 dark:bg-zinc-900">
          <Text className="font-semibold text-zinc-950 dark:text-white">
            Aucune commande pour le moment.
          </Text>
          <Text className="mt-1">
            Les commandes Medusa payées apparaîtront ici dès qu&apos;un client passera commande.
          </Text>
        </div>
      )}

      {orders.length > 0 && (
        <div className="flex flex-1 flex-col rounded-lg bg-white p-6 ring-1 ring-zinc-950/5 dark:bg-zinc-900 dark:ring-white/10">
          <div className="flex items-baseline gap-2">
            <Subheading>Toutes les commandes</Subheading>
            <Text className="text-xs uppercase tracking-wider text-zinc-500">
              · {orders.length} affichée{orders.length > 1 ? 's' : ''}
            </Text>
          </div>
          <Table className="mt-4">
            <TableHead>
              <TableRow>
                <TableHeader>Commande</TableHeader>
                <TableHeader>Client</TableHeader>
                <TableHeader>Total</TableHeader>
                <TableHeader>Paiement</TableHeader>
                <TableHeader>AliExpress</TableHeader>
                <TableHeader className="text-right">Action</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {orders.map((order) => {
                const forward = forwardsByOrder.get(order.id) ?? null;
                const sent = forward?.status === 'sent';
                const paymentOk =
                  order.payment_status === 'captured' || order.payment_status === 'authorized';
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
                      <div className="max-w-[160px] truncate text-zinc-500">
                        {order.email ?? '—'}
                      </div>
                      {order.shipping_address?.city && (
                        <div className="mt-0.5 text-xs text-zinc-500">{order.shipping_address.city}</div>
                      )}
                    </TableCell>
                    <TableCell className="font-semibold tabular-nums text-zinc-950 dark:text-white">
                      {formatMoney(order.total, order.currency_code)}
                    </TableCell>
                    <TableCell>
                      <Badge color={paymentOk ? 'green' : 'zinc'}>
                        {order.payment_status ?? order.status ?? '—'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {forward ? (
                        forward.status === 'sent' && forward.ae_order_id ? (
                          <div className="flex flex-col items-start gap-1">
                            <Badge color={forward.paid_at ? 'green' : 'zinc'}>
                              {forward.paid_at ? 'payée' : 'à payer'}
                            </Badge>
                            <a
                              href={aliExpressOrderUrl(forward.ae_order_id)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-mono text-xs text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300"
                            >
                              {forward.ae_order_id}
                            </a>
                          </div>
                        ) : forward.status === 'dry_run' ? (
                          <Badge color="green">dry-run prêt</Badge>
                        ) : (
                          <div className="flex max-w-[200px] flex-col items-start gap-1">
                            <Badge color="red">erreur</Badge>
                            {forward.error_message && (
                              <span
                                className="line-clamp-2 text-xs text-zinc-500"
                                title={forward.error_message}
                              >
                                {forward.error_message}
                              </span>
                            )}
                          </div>
                        )
                      ) : (
                        <span className="text-sm text-zinc-500">—</span>
                      )}
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
        </div>
      )}
    </div>
  );
}
