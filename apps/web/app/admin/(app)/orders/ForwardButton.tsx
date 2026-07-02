'use client';

import { apiFetch } from '@/lib/client-fetch';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogActions,
} from '@/components/catalyst/dialog';
import { Button } from '@/components/catalyst/button';

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

  // Headless UI restores focus to the trigger button on close.
  const closeModal = useCallback(() => {
    setModalOpen(false);
  }, []);

  const confirmSend = useCallback(async () => {
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
  }, [forward, router]);

  // Has something to send when there is at least one forward leg from dry-run.
  const canSend =
    dryRunResult?.ok &&
    dryRunResult.status === 'dry_run' &&
    (dryRunResult.forwards.length ?? 0) > 0;

  const sentLegs = sentResult?.forwards ?? [];
  const sentAny = sentLegs.some((f) => f.status === 'sent');

  return (
    <div className="flex flex-col items-end gap-1.5">
      <Button
        color="indigo"
        disabled={alreadySent}
        onClick={openModal}
        title={alreadySent ? 'Déjà envoyée au fournisseur' : 'Préparer et envoyer la commande'}
      >
        {alreadySent ? 'Envoyée' : 'Envoyer'}
      </Button>

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
                <span key={i} className={leg.status === 'error' ? 'text-gray-400' : undefined}>
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

      <ReviewModal
        open={modalOpen}
        dryRunning={dryRunning}
        dryRunResult={dryRunResult}
        sending={sending}
        sentResult={sentResult}
        canSend={!!canSend}
        onClose={closeModal}
        onConfirm={confirmSend}
      />
    </div>
  );
}

function ReviewModal({
  open,
  dryRunning,
  dryRunResult,
  sending,
  sentResult,
  canSend,
  onClose,
  onConfirm,
}: {
  open: boolean;
  dryRunning: boolean;
  dryRunResult: ForwardResult | null;
  sending: boolean;
  sentResult: ForwardResult | null;
  canSend: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const forwards = dryRunResult?.forwards ?? [];
  const unmapped = dryRunResult?.unmappedItems ?? [];
  const sentLegs = sentResult?.forwards ?? [];
  const sentAnyModal = sentLegs.some((f) => f.status === 'sent');
  const erroredAnyModal = sentLegs.some((f) => f.status === 'error');

  return (
    // Catalyst Dialog handles focus trap, Escape, backdrop and scroll lock.
    // While a live send is in-flight, closing is blocked (Escape + backdrop).
    <Dialog open={open} onClose={sending ? () => {} : onClose} size="xl">
      <DialogTitle>Vérifier la commande fournisseur</DialogTitle>
      <DialogDescription>
        Chaque leg sera créé chez son fournisseur. Le dry-run sauve le payload sans rien envoyer.
      </DialogDescription>

      <DialogBody className="space-y-4">
        {sentResult && sentLegs.length > 0 ? (
          // One row per leg so a partial send ({AE:sent, CJ:error}) is legible:
          // the sent legs show their reference, the errored legs show why.
          <div
            className={
              sentAnyModal
                ? 'rounded-lg bg-indigo-500/10 px-4 py-3 ring-1 ring-inset ring-indigo-500/20'
                : 'rounded-lg bg-zinc-950/40 px-4 py-3 ring-1 ring-inset ring-white/10'
            }
          >
            <p
              className={
                sentAnyModal
                  ? 'rounded-lg bg-indigo-500/10 px-4 py-3 ring-1 ring-inset ring-indigo-500/20'
                  : 'rounded-lg bg-gray-800/50 px-4 py-3 ring-1 ring-inset ring-white/10'
              }
            >
              {erroredAnyModal
                ? sentAnyModal
                  ? 'Envoi partiel'
                  : "Échec de l'envoi"
                : 'Envoyée'}
            </p>
            {sentLegs.map((leg, i) =>
              leg.status === 'sent' ? (
                <p key={i} className="mt-1 text-xs text-zinc-400">
                  {leg.supplier === 'aliexpress'
                    ? `AE #${leg.supplierOrderId} : connecte-toi sur aliexpress.com pour finaliser le paiement.`
                    : `${leg.supplier} #${leg.supplierOrderId}`}
                </p>
              ) : (
                <p key={i} className="mt-1 text-xs text-zinc-400">
                  {legName(leg.supplier)} : {leg.error ?? 'erreur inconnue'}
                </p>
              ),
            )}
          </div>
        ) : sentResult?.status === 'error' ? (
          <div className="rounded-lg bg-zinc-950/40 px-4 py-3 ring-1 ring-inset ring-white/10">
            <p className="text-sm font-medium text-white">Erreur lors de l&apos;envoi</p>
            <p className="mt-1 text-xs text-zinc-400">{sentResult.error}</p>
          </div>
        ) : dryRunning ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-zinc-400">
            <span className="h-2 w-2 animate-pulse rounded-full bg-indigo-400" />
            Préparation du payload fournisseur…
          </div>
        ) : dryRunResult?.status === 'error' || !dryRunResult?.ok ? (
          <div className="rounded-lg bg-zinc-950/40 px-4 py-3 ring-1 ring-inset ring-white/10">
            <p className="text-sm font-medium text-white">Impossible de préparer la commande</p>
            <p className="mt-1 text-xs text-zinc-400">{dryRunResult?.error ?? 'Erreur inconnue'}</p>
          </div>
        ) : (
          <>
            {forwards.map((leg, legIdx) => {
              const addr = leg.payload.address;
              const items = leg.payload.items;
              return (
                <div key={legIdx} className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
                    Leg {legIdx + 1} · {legName(leg.supplier)}
                  </p>
                ) : (
                  <p key={i} className="mt-1 text-xs text-gray-400">
                    {legName(leg.supplier)} : {leg.error ?? 'erreur inconnue'}
                  </p>
                ),
              )}
            </div>
          ) : sentResult?.status === 'error' ? (
            <div className="rounded-lg bg-gray-800/50 px-4 py-3 ring-1 ring-inset ring-white/10">
              <p className="text-sm font-medium text-white">Erreur lors de l&apos;envoi</p>
              <p className="mt-1 text-xs text-gray-400">{sentResult.error}</p>
            </div>
          ) : dryRunning ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-gray-400">
              <span className="h-2 w-2 animate-pulse rounded-full bg-indigo-400" />
              Préparation du payload fournisseur…
            </div>
          ) : dryRunResult?.status === 'error' || !dryRunResult?.ok ? (
            <div className="rounded-lg bg-gray-800/50 px-4 py-3 ring-1 ring-inset ring-white/10">
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
                    <div className="text-sm leading-relaxed text-zinc-400">
                      {addr.fullName && <div className="font-medium text-white">{addr.fullName}</div>}
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
                      <p className="text-xs text-zinc-400">Aucun produit mappable, envoi impossible.</p>
                    ) : (
                      <ul className="space-y-1.5">
                        {items.map((it, i) => (
                          <li key={i} className="flex items-baseline gap-2 text-xs">
                            <span className="font-mono text-zinc-400">{it.externalId}</span>
                            <span className="text-zinc-500">×{it.quantity}</span>
                            {it.skuAttr && <span className="font-mono text-zinc-500">{it.skuAttr}</span>}
                          </li>
                        ))}
                      </ul>
                    )}
                  </Section>
                </div>
              );
            })}

            {unmapped.length > 0 && (
              <Section title={`Items non mappés (${unmapped.length})`}>
                <ul className="space-y-1.5">
                  {unmapped.map((u, i) => (
                    <li key={i} className="text-xs text-zinc-400">
                      <div className="font-medium text-white">{u.title}</div>
                      <div className="text-zinc-400">{u.reason}</div>
                    </li>
                  ))}
                </ul>
              </Section>
            )}
          </>
        )}
      </DialogBody>

      <DialogActions>
        <Button plain onClick={onClose} disabled={sending}>
          {sentResult?.ok || sentAnyModal ? 'Fermer' : 'Annuler'}
        </Button>
        {/* Hide the confirm button once ANY leg was placed — a re-click on a
            partial send would only hit the 23505 "already in-flight" error. */}
        {!sentResult?.ok && !sentAnyModal && (
          <Button color="indigo" onClick={onConfirm} disabled={!canSend || sending || dryRunning}>
            {sending ? 'Envoi…' : "Confirmer l'envoi"}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
  tone?: 'default' | 'warn';
}) {
  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
        {title}
      </h3>
      <div className="rounded-lg bg-gray-900/50 px-4 py-3 ring-1 ring-inset ring-white/10">
        {children}
      </div>
    </section>
  );
}
