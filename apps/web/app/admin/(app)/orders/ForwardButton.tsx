'use client';

import { apiFetch } from '@/lib/client-fetch';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  orderId: string;
  alreadySent: boolean;
}

interface ForwardPayload {
  logistics_address?: {
    full_name?: string;
    address?: string;
    city?: string;
    zip?: string;
    country?: string;
  };
  product_items?: { product_id: string; product_count: number; sku_attr?: string }[];
}

interface ForwardResponse {
  ok: boolean;
  status: 'dry_run' | 'sent' | 'error';
  forwardId: string;
  aeOrderId?: string;
  error?: string;
  unmappedItems?: { itemId: string; title: string; reason: string }[];
  payload?: ForwardPayload;
}

export function ForwardButton({ orderId, alreadySent }: Props) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [dryRunResult, setDryRunResult] = useState<ForwardResponse | null>(null);
  const [dryRunning, setDryRunning] = useState(false);
  const [sending, setSending] = useState(false);
  const [sentResult, setSentResult] = useState<ForwardResponse | null>(null);

  const forward = useCallback(
    async (dryRun: boolean): Promise<ForwardResponse> => {
      const res = await apiFetch(`/api/agent/orders/${orderId}/forward`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dryRun,
          ...(dryRun ? {} : { confirm: 'PLACE_REAL_ORDER' }),
        }),
      });
      return (await res.json()) as ForwardResponse;
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
          forwardId: '',
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
      if (r.ok) router.refresh();
    } catch (e) {
      setSentResult({
        ok: false,
        status: 'error',
        forwardId: '',
        error: e instanceof Error ? e.message : 'Network error',
      });
    } finally {
      setSending(false);
    }
  }

  const canSend =
    dryRunResult?.ok &&
    dryRunResult.status === 'dry_run' &&
    (dryRunResult.payload?.product_items?.length ?? 0) > 0;

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
        title={alreadySent ? 'Déjà envoyée à AliExpress' : 'Préparer et envoyer la commande AE'}
      >
        {alreadySent ? 'Envoyée' : 'Envoyer à AE'}
      </button>

      {sentResult && !modalOpen && (
        <div
          className={
            sentResult.ok
              ? 'max-w-[280px] rounded-md px-2.5 py-1.5 text-[11px] bg-indigo-500/10 text-indigo-400 ring-1 ring-inset ring-indigo-500/20'
              : 'max-w-[280px] rounded-md px-2.5 py-1.5 text-[11px] bg-gray-800/50 text-gray-400 ring-1 ring-inset ring-white/10'
          }
        >
          {sentResult.status === 'sent' && `Envoyée — AE #${sentResult.aeOrderId}`}
          {sentResult.status === 'error' && (sentResult.error ?? 'Erreur inconnue')}
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
  dryRunResult: ForwardResponse | null;
  sending: boolean;
  sentResult: ForwardResponse | null;
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

  const addr = dryRunResult?.payload?.logistics_address;
  const items = dryRunResult?.payload?.product_items ?? [];
  const unmapped = dryRunResult?.unmappedItems ?? [];

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
            Vérifier la commande AliExpress
          </h2>
          <p className="mt-1 text-xs text-gray-400">
            Cette commande sera créée chez AE en statut « En attente de paiement ». Tu paieras
            ensuite manuellement sur aliexpress.com.
          </p>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {sentResult?.ok && sentResult.status === 'sent' ? (
            <div className="rounded-lg bg-indigo-500/10 px-4 py-3 ring-1 ring-inset ring-indigo-500/20">
              <p className="text-sm font-medium text-indigo-400">
                Envoyée — AE #{sentResult.aeOrderId}
              </p>
              <p className="mt-1 text-xs text-gray-400">
                Connecte-toi sur aliexpress.com pour finaliser le paiement.
              </p>
            </div>
          ) : sentResult?.status === 'error' ? (
            <div className="rounded-lg bg-red-500/10 px-4 py-3 ring-1 ring-inset ring-red-500/20">
              <p className="text-sm font-medium text-white">Erreur lors de l&apos;envoi</p>
              <p className="mt-1 text-xs text-gray-400">{sentResult.error}</p>
            </div>
          ) : dryRunning ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-gray-400">
              <span className="h-2 w-2 animate-pulse rounded-full bg-indigo-400" />
              Préparation du payload AE…
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
              {addr && (
                <Section title="Adresse de livraison">
                  <div className="text-sm leading-relaxed text-gray-400">
                    {addr.full_name && (
                      <div className="font-medium text-white">{addr.full_name}</div>
                    )}
                    {addr.address && <div>{addr.address}</div>}
                    <div>
                      {[addr.zip, addr.city].filter(Boolean).join(' ')}
                      {addr.country && ` · ${addr.country.toUpperCase()}`}
                    </div>
                  </div>
                </Section>
              )}

              <Section title={`Produits AE (${items.length})`}>
                {items.length === 0 ? (
                  <p className="text-xs text-gray-400">
                    Aucun produit mappable — envoi impossible.
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {items.map((it, i) => (
                      <li key={i} className="flex items-baseline gap-2 text-xs">
                        <span className="font-mono text-gray-400">{it.product_id}</span>
                        <span className="text-gray-500">×{it.product_count}</span>
                        {it.sku_attr && (
                          <span className="font-mono text-gray-500">{it.sku_attr}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </Section>

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
            {sentResult?.ok ? 'Fermer' : 'Annuler'}
          </button>
          {!sentResult?.ok && (
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
            ? 'mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-400'
            : 'mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-500'
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
