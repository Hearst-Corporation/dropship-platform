import { medusa } from '@/lib/medusa';
import { getDbRead } from '@/lib/db';
import { ForwardButton } from './ForwardButton';
import { DryRunPendingButton } from './DryRunPendingButton';
import { MarkPaidButton } from './MarkPaidButton';
import { formatMoney } from '@/lib/medusa-store';
import { aliExpressOrderUrl } from '@/lib/suppliers/aliexpress';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { AdminStatGrid, AdminStatCard } from '@/components/admin/AdminStatCard';
import { AdminBadge } from '@/components/admin/AdminBadge';
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

  return (
    <div className="flex flex-1 flex-col space-y-6">
      <AdminPageHeader
        eyebrow="Production · Dropship"
        title="Carnet de commandes"
        description="Forward chaque commande payée vers AliExpress. Le dry-run sauve le payload sans rien envoyer."
        actions={<DryRunPendingButton />}
      />

      <AdminStatGrid>
        <AdminStatCard label="Commandes payées" value={String(stats.paidOrders)} />
        <AdminStatCard label="À payer chez AE" value={String(stats.awaitingPayment)} />
        <AdminStatCard label="Payées chez AE" value={String(stats.paidAtAe)} />
        <AdminStatCard label="Erreurs forward" value={String(stats.errors)} />
      </AdminStatGrid>

      {fetchError && (
        <div className="rounded-lg bg-red-500/10 px-4 py-3 ring-1 ring-red-500/20">
          <span className="text-sm text-red-400">Erreur Medusa : {fetchError}</span>
        </div>
      )}

      {awaitingPayment.length > 0 && (
        <section className="overflow-hidden rounded-xl bg-gray-800/50 ring-1 ring-white/10">
          <div className="border-b border-white/10 px-4 py-4 sm:px-6">
            <div className="flex items-baseline gap-2">
              <h3 className="text-base font-semibold text-white">À payer chez AliExpress</h3>
              <span className="text-xs uppercase tracking-wider text-gray-500">
                · {awaitingPayment.length} commande{awaitingPayment.length > 1 ? 's' : ''}
              </span>
            </div>
            <p className="mt-1 text-sm text-gray-400">
              AE n&apos;a pas d&apos;API de paiement. Ouvre le lien, paie sur aliexpress.com, puis clique{' '}
              <strong className="font-medium text-white">Marquer payée</strong>. Annulation auto après{' '}
              <strong className="font-medium text-white">20 jours</strong>.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/10">
              <thead>
                <tr>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-white sm:px-6">Commande</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-white">Client</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-white">Total</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-white">Order AE</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-white">Forwardée</th>
                  <th scope="col" className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-white sm:px-6">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {awaitingPayment.map((row) => {
                  const ageMs = Date.now() - new Date(row.forwarded_at).getTime();
                  const ageHours = Math.floor(ageMs / 3_600_000);
                  const ageLabel =
                    ageHours < 1 ? '< 1 h' : ageHours < 48 ? `${ageHours} h` : `${Math.floor(ageHours / 24)} j`;
                  const stale = ageHours >= 24 * 15;
                  return (
                    <tr key={row.medusa_order_id}>
                      <td className="px-4 py-3 sm:px-6">
                        <div className="font-medium text-white">
                          #{row.display_id ?? row.medusa_order_id.slice(0, 8)}
                        </div>
                        <div className="mt-0.5 max-w-[140px] truncate font-mono text-xs text-gray-500">
                          {row.medusa_order_id}
                        </div>
                      </td>
                      <td className="max-w-[160px] truncate px-4 py-3 text-sm text-gray-400">
                        {row.customer_email ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold tabular-nums text-white">
                        {row.total_minor != null && row.currency_code
                          ? formatMoney(row.total_minor, row.currency_code)
                          : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <a
                          href={aliExpressOrderUrl(row.ae_order_id)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 font-mono text-xs text-indigo-400 hover:text-indigo-300"
                        >
                          {row.ae_order_id}
                          <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" aria-hidden="true" />
                        </a>
                      </td>
                      <td className="px-4 py-3">
                        <AdminBadge color={stale ? 'amber' : 'zinc'}>il y a {ageLabel}</AdminBadge>
                        {stale && <div className="mt-1 text-xs font-medium text-indigo-400">proche annulation</div>}
                      </td>
                      <td className="px-4 py-3 text-right sm:px-6">
                        <MarkPaidButton orderId={row.medusa_order_id} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {!fetchError && orders.length === 0 && (
        <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-white/10 bg-gray-800/50 px-6 py-12 text-center">
          <p className="text-sm font-semibold text-white">Aucune commande pour le moment.</p>
          <p className="mt-1 text-sm text-gray-400">
            Les commandes Medusa payées apparaîtront ici dès qu&apos;un client passera commande.
          </p>
        </div>
      )}

      {orders.length > 0 && (
        <section className="flex flex-1 flex-col overflow-hidden rounded-xl bg-gray-800/50 ring-1 ring-white/10">
          <div className="flex items-baseline gap-2 border-b border-white/10 px-4 py-4 sm:px-6">
            <h3 className="text-base font-semibold text-white">Toutes les commandes</h3>
            <span className="text-xs uppercase tracking-wider text-gray-500">
              · {orders.length} affichée{orders.length > 1 ? 's' : ''}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/10">
              <thead>
                <tr>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-white sm:px-6">Commande</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-white">Client</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-white">Total</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-white">Paiement</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-white">AliExpress</th>
                  <th scope="col" className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-white sm:px-6">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {orders.map((order) => {
                  const forward = forwardsByOrder.get(order.id) ?? null;
                  const sent = forward?.status === 'sent';
                  const paymentOk =
                    order.payment_status === 'captured' || order.payment_status === 'authorized';
                  return (
                    <tr key={order.id}>
                      <td className="px-4 py-3 sm:px-6">
                        <div className="font-medium text-white">#{order.display_id ?? order.id.slice(0, 8)}</div>
                        <div className="mt-0.5 text-xs text-gray-500">
                          {new Date(order.created_at).toLocaleDateString('fr-FR', {
                            day: '2-digit', month: 'short', year: 'numeric',
                          })}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="max-w-[160px] truncate text-sm text-gray-400">
                          {order.email ?? '—'}
                        </div>
                        {order.shipping_address?.city && (
                          <div className="mt-0.5 text-xs text-gray-500">{order.shipping_address.city}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold tabular-nums text-white">
                        {formatMoney(order.total, order.currency_code)}
                      </td>
                      <td className="px-4 py-3">
                        <AdminBadge color={paymentOk ? 'green' : 'zinc'}>
                          {order.payment_status ?? order.status ?? '—'}
                        </AdminBadge>
                      </td>
                      <td className="px-4 py-3">
                        {forward ? (
                          forward.status === 'sent' && forward.ae_order_id ? (
                            <div className="flex flex-col items-start gap-1">
                              <AdminBadge color={forward.paid_at ? 'green' : 'zinc'}>
                                {forward.paid_at ? 'payée' : 'à payer'}
                              </AdminBadge>
                              <a
                                href={aliExpressOrderUrl(forward.ae_order_id)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-mono text-xs text-indigo-400 hover:text-indigo-300"
                              >
                                {forward.ae_order_id}
                              </a>
                            </div>
                          ) : forward.status === 'dry_run' ? (
                            <AdminBadge color="green">dry-run prêt</AdminBadge>
                          ) : (
                            <div className="flex max-w-[200px] flex-col items-start gap-1">
                              <AdminBadge color="red">erreur</AdminBadge>
                              {forward.error_message && (
                                <span
                                  className="line-clamp-2 text-xs text-gray-500"
                                  title={forward.error_message}
                                >
                                  {forward.error_message}
                                </span>
                              )}
                            </div>
                          )
                        ) : (
                          <span className="text-sm text-gray-500">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right sm:px-6">
                        <div className="flex justify-end">
                          <ForwardButton orderId={order.id} alreadySent={sent} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
