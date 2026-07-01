'use client';

import { apiFetch } from '@/lib/client-fetch';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  orderId: string;
  alreadySent: boolean;
}

/** Mirror of SupplierAddress from lib/suppliers/types.ts (client component — no server import). */
interface SupplierAddress {
  fullName: string;
  contactPerson: string;
  address1: string;
  address2?: string;
  city: string;
  province: string;
  countryCode: string;
  zip: string;
  phoneDial: string;
  phoneNumber: string;
}

/** Mirror of PlaceOrderInput from lib/suppliers/types.ts. */
interface PlaceOrderInput {
  outOrderId: string;
  address: SupplierAddress;
  items: { externalId: string; quantity: number; skuAttr?: string }[];
}

/** Mirror of ForwardLeg from lib/agent/order-forwarder.ts. */
interface ForwardLeg {
  supplier: string;
  status: 'dry_run' | 'sent' | 'error';
  forwardId: string;
  supplierOrderId?: string;
  payload: PlaceOrderInput;
  error?: string;
}

/** Mirror of ForwardResult from lib/agent/order-forwarder.ts. */
interface ForwardResult {
  ok: boolean;
  /** True on a mixed outcome: at least one leg sent AND at least one errored. */
  partial?: boolean;
  forwards: ForwardLeg[];
  unmappedItems: { itemId: string; title: string; reason: string }[];
  status: 'dry_run' | 'sent' | 'error';
  error?: string;
}

/** Human label for a supplier id (AliExpress gets the "AE" shorthand). */
function legName(supplier: string): string {
  return supplier === 'aliexpress'
    ? 'AliExpress'
    : supplier.charAt(0).toUpperCase() + supplier.slice(1);
}

/** "AE #123" / "cj #456" reference for a sent leg. */
function legRef(leg: ForwardLeg): string {
  return leg.supplier === 'aliexpress'
    ? `AE #${leg.supplierOrderId}`
    : `${leg.supplier} #${leg.supplierOrderId}`;
}

export function ForwardButton({ orderId, alreadySent }: Props) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [dryRunResult, setDryRunResult] = useState<ForwardResult | null>(null);
  const [dryRunning, setDryRunning] = useState(false);
  const [sending, setSending] = useState(false);
  const [sentResult, setSentResult] = useState<ForwardResult | null>(null);

  const forward = useCallback(
    async (dryRun: boolean): Promise<ForwardResult> => {
      const res = await apiFetch(`/api/agent/orders/${orderId}/forward`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dryRun,
          ...(dryRun ? {} : { confirm: 'PLACE_REAL_ORDER' }),
        }),
      });
      return (await res.json()) as ForwardResult;
    },
    [orderId],
  );

  // Auto-run dry-run when the modal opens.
  useEffect(() => {
    if (!modalOpen || dryRunResult || dryRunning) return;
    setDryRunning(true);
    forward(true)
      .then((r) => setDryRunResult(r))
      .catch((e) =>
        setDryRunResult({
          ok: false,
          status: 'error',
          forwards: [],
          unmappedItems: [],
          error: e instanceof Error ? e.message : 'Network error',
        }),
      )
      .finally(() => setDryRunning(false));
  }, [modalOpen, dryRunResult, dryRunning, forward]);

  function openModal() {
    setDryRunResult(null);
    setSentResult(null);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
  }

  async function confirmSend() {
    setSending(true);
    try {
      const r = await forward(false);
      setSentResult(r);
      // Refresh whenever ANY leg was actually sent — a partial forward
      // ({AE:sent, CJ:error}) returns ok=false but really placed a supplier
      // order. Without the refresh the button stayed enabled and a re-click hit
      // the "already in-flight" 23505 error. Refresh on any sent leg so the row
      // reflects reality.
      if (r.forwards?.some((f) => f.status === 'sent')) router.refresh();
    } catch (e) {
      setSentResult({
        ok: false,
        status: 'error',
        forwards: [],
        unmappedItems: [],
        error: e instanceof Error ? e.message : 'Network error',
      });
    } finally {
      setSending(false);
    }
  }

  // Has something to send when there is at least one forward leg from dry-run.
  const canSend =
    dryRunResult?.ok &&
    dryRunResult.status === 'dry_run' &&
    (dryRunResult.forwards.length ?? 0) > 0;

  // Inline result badge shown outside the modal after a send.
  const sentLegs = sentResult?.forwards ?? [];
  // A partial send really placed at least one supplier order, so tone the badge
  // as a success (indigo) even though ok=false.
  const sentAny = sentLegs.some((f) => f.status === 'sent');

  return (
    <div className="flex flex-col items-end gap-1.5">
      <button
        onClick={openModal}
        disabled={alreadySent}
        className={
          alreadySent
            ? 'rounded-md px-3 py-1.5 text-xs font-medium text-gray-500 ring-1 ring-inset ring-white/10 cursor-not-allowed'
            : 'rounded-md bg-indigo-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-400'
        }
        title={alreadySent ? 'Déjà envoyée au fournisseur' : 'Préparer et envoyer la commande'}
      >
        {alreadySent ? 'Envoyée' : 'Envoyer'}
      </button>

      {sentResult && !modalOpen && (
        <div
          className={
            sentResult.ok || sentAny
              ? 'max-w-xs rounded-md px-2.5 py-1.5 text-xs bg-indigo-500/10 text-indigo-400 ring-1 ring-inset ring-indigo-500/20'
              : 'max-w-xs rounded-md px-2.5 py-1.5 text-xs bg-gray-800/50 text-gray-400 ring-1 ring-inset ring-white/10'
          }
        >
          {sentLegs.length > 0 ? (
            <div className="flex flex-col gap-0.5">
              {sentLegs.map((leg, i) => (
                <span key={i} className={leg.status === 'error' ? 'text-red-400' : undefined}>
                  {leg.status === 'sent'
                    ? `Envoyée — ${legRef(leg)}`
                    : `Échec — ${legName(leg.supplier)}${leg.error ? ` : ${leg.error}` : ''}`}
                </span>
              ))}
            </div>
          ) : (
            sentResult.error ?? 'Erreur inconnue'
          )}
        </div>
      )}

      {modalOpen && (
        <ReviewModal
          dryRunning={dryRunning}
          dryRunResult={dryRunResult}
          sending={sending}
          sentResult={sentResult}
          canSend={!!canSend}
          onClose={closeModal}
          onConfirm={confirmSend}
        />
      )}
    </div>
  );
}

function ReviewModal({
  dryRunning,
  dryRunResult,
  sending,
  sentResult,
  canSend,
  onClose,
  onConfirm,
}: {
  dryRunning: boolean;
  dryRunResult: ForwardResult | null;
  sending: boolean;
  sentResult: ForwardResult | null;
  canSend: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !sending) onClose();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose, sending]);

  const forwards = dryRunResult?.forwards ?? [];
  const unmapped = dryRunResult?.unmappedItems ?? [];
  const sentLegs = sentResult?.forwards ?? [];
  const sentAnyModal = sentLegs.some((f) => f.status === 'sent');
  const erroredAnyModal = sentLegs.some((f) => f.status === 'error');

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="forward-review-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-gray-900/80 backdrop-blur-xs"
        onClick={() => !sending && onClose()}
      />
      {/* Panel */}
      <div className="relative flex max-h-[90vh] w-full max-w-xl flex-col rounded-xl bg-gray-800 ring-1 ring-inset ring-white/10 shadow-2xl">
        <header className="border-b border-white/10 px-5 py-4">
          <h2 id="forward-review-title" className="text-base font-semibold text-white">
            Vérifier la commande fournisseur
          </h2>
          <p className="mt-1 text-xs text-gray-400">
            Chaque leg sera créé chez son fournisseur. Le dry-run sauve le payload sans rien envoyer.
          </p>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {sentResult && sentLegs.length > 0 ? (
            // One row per leg so a partial send ({AE:sent, CJ:error}) is legible:
            // the sent legs show their reference, the errored legs show why.
            <div
              className={
                sentAnyModal
                  ? 'rounded-lg bg-indigo-500/10 px-4 py-3 ring-1 ring-inset ring-indigo-500/20'
                  : 'rounded-lg bg-red-500/10 px-4 py-3 ring-1 ring-inset ring-red-500/20'
              }
            >
              <p className={sentAnyModal ? 'text-sm font-medium text-indigo-400' : 'text-sm font-medium text-white'}>
                {erroredAnyModal
                  ? sentAnyModal
                    ? 'Envoi partiel'
                    : "Échec de l'envoi"
                  : 'Envoyée'}
              </p>
              {sentLegs.map((leg, i) =>
                leg.status === 'sent' ? (
                  <p key={i} className="mt-1 text-xs text-gray-400">
                    {leg.supplier === 'aliexpress'
                      ? `AE #${leg.supplierOrderId} — connecte-toi sur aliexpress.com pour finaliser le paiement.`
                      : `${leg.supplier} #${leg.supplierOrderId}`}
                  </p>
                ) : (
                  <p key={i} className="mt-1 text-xs text-red-400">
                    {legName(leg.supplier)} : {leg.error ?? 'erreur inconnue'}
                  </p>
                ),
              )}
            </div>
          ) : sentResult?.status === 'error' ? (
            <div className="rounded-lg bg-red-500/10 px-4 py-3 ring-1 ring-inset ring-red-500/20">
              <p className="text-sm font-medium text-white">Erreur lors de l&apos;envoi</p>
              <p className="mt-1 text-xs text-gray-400">{sentResult.error}</p>
            </div>
          ) : dryRunning ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-gray-400">
              <span className="h-2 w-2 animate-pulse rounded-full bg-indigo-400" />
              Préparation du payload fournisseur…
            </div>
          ) : dryRunResult?.status === 'error' || !dryRunResult?.ok ? (
            <div className="rounded-lg bg-red-500/10 px-4 py-3 ring-1 ring-inset ring-red-500/20">
              <p className="text-sm font-medium text-white">Impossible de préparer la commande</p>
              <p className="mt-1 text-xs text-gray-400">
                {dryRunResult?.error ?? 'Erreur inconnue'}
              </p>
            </div>
          ) : (
            <>
              {forwards.map((leg, legIdx) => {
                const addr = leg.payload.address;
                const items = leg.payload.items;
                const legLabel =
                  leg.supplier === 'aliexpress'
                    ? 'AliExpress'
                    : leg.supplier.charAt(0).toUpperCase() + leg.supplier.slice(1);
                return (
                  <div key={legIdx} className="space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
                      Leg {legIdx + 1} — {legLabel}
                    </p>

                    <Section title="Adresse de livraison">
                      <div className="text-sm leading-relaxed text-gray-400">
                        {addr.fullName && (
                          <div className="font-medium text-white">{addr.fullName}</div>
                        )}
                        {addr.address1 && <div>{addr.address1}</div>}
                        {addr.address2 && <div>{addr.address2}</div>}
                        <div>
                          {[addr.zip, addr.city].filter(Boolean).join(' ')}
                          {addr.countryCode && ` · ${addr.countryCode.toUpperCase()}`}
                        </div>
                      </div>
                    </Section>

                    <Section title={`Produits (${items.length})`}>
                      {items.length === 0 ? (
                        <p className="text-xs text-gray-400">
                          Aucun produit mappable — envoi impossible.
                        </p>
                      ) : (
                        <ul className="space-y-1.5">
                          {items.map((it, i) => (
                            <li key={i} className="flex items-baseline gap-2 text-xs">
                              <span className="font-mono text-gray-400">{it.externalId}</span>
                              <span className="text-gray-500">×{it.quantity}</span>
                              {it.skuAttr && (
                                <span className="font-mono text-gray-500">{it.skuAttr}</span>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </Section>
                  </div>
                );
              })}

              {unmapped.length > 0 && (
                <Section title={`Items non mappés (${unmapped.length})`} tone="warn">
                  <ul className="space-y-1.5">
                    {unmapped.map((u, i) => (
                      <li key={i} className="text-xs text-gray-400">
                        <div className="font-medium text-white">{u.title}</div>
                        <div className="text-gray-400">{u.reason}</div>
                      </li>
                    ))}
                  </ul>
                </Section>
              )}
            </>
          )}
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-white/10 bg-gray-900/50 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={sending}
            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-400 hover:bg-white/5 hover:text-white disabled:opacity-50"
          >
            {sentResult?.ok || sentAnyModal ? 'Fermer' : 'Annuler'}
          </button>
          {/* Hide the confirm button once ANY leg was placed — a re-click on a
              partial send would only hit the 23505 "already in-flight" error. */}
          {!sentResult?.ok && !sentAnyModal && (
            <button
              type="button"
              onClick={onConfirm}
              disabled={!canSend || sending || dryRunning}
              className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {sending ? 'Envoi…' : "Confirmer l'envoi"}
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
  tone = 'default',
}: {
  title: string;
  children: React.ReactNode;
  tone?: 'default' | 'warn';
}) {
  return (
    <section>
      <h3
        className={
          tone === 'warn'
            ? 'mb-2 text-xs font-semibold uppercase tracking-wider text-amber-400'
            : 'mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500'
        }
      >
        {title}
      </h3>
      <div
        className={
          tone === 'warn'
            ? 'rounded-lg bg-amber-500/10 px-4 py-3 ring-1 ring-inset ring-amber-500/20'
            : 'rounded-lg bg-gray-900/50 px-4 py-3 ring-1 ring-inset ring-white/10'
        }
      >
        {children}
      </div>
    </section>
  );
}
