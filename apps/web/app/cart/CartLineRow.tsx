'use client';

import { apiFetch } from '@/lib/client-fetch';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { formatMoney, type StoreLineItem } from '@/lib/medusa-store';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

export function CartLineRow({ item, currency }: { item: StoreLineItem; currency: string }) {
  const [qty, setQty] = useState(item.quantity);
  const [pending, startTransition] = useTransition();
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function update(newQty: number) {
    const previousQty = qty;
    setQty(newQty);
    setError(null);
    startTransition(async () => {
      try {
        const res = await apiFetch('/api/cart/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lineItemId: item.id, quantity: newQty }),
        });
        if (!res.ok) {
          // Server rejected the update: revert the optimistic quantity so
          // the UI never shows a value that was never actually persisted.
          setQty(previousQty);
          setError('Erreur réseau, quantité non mise à jour.');
          return;
        }
        router.refresh();
      } catch {
        setQty(previousQty);
        setError('Erreur réseau, quantité non mise à jour.');
      }
    });
  }

  return (
    <tr style={{ borderColor: 'var(--ct-border-soft, rgba(255,255,255,0.06))' }}>
      <td className="p-6">
        <div className="flex items-center gap-5">
          {item.thumbnail ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.thumbnail}
              alt={item.title}
              className="w-20 h-20 rounded-lg object-cover"
              style={{ backgroundColor: 'var(--ct-surface-2, rgba(255,255,255,0.06))' }}
            />
          ) : (
            <div
              className="w-20 h-20 rounded-lg"
              style={{ backgroundColor: 'var(--ct-surface-2, rgba(255,255,255,0.06))' }}
            />
          )}
          <div>
            <p
              className="font-medium text-base"
              style={{ color: 'var(--ct-text-primary, rgba(245,245,245,0.92))' }}
            >
              {item.title}
            </p>
            <p
              className="text-sm mt-1"
              style={{ color: 'var(--ct-text-muted, rgba(245,245,245,0.48))' }}
            >
              {formatMoney(item.unit_price, currency)} / unité
            </p>
          </div>
        </div>
      </td>
      <td className="p-6">
        <div
          className="inline-flex items-center rounded-full border"
          style={{
            borderColor: 'var(--ct-border, rgba(255,255,255,0.10))',
            backgroundColor: 'var(--ct-surface-1, rgba(255,255,255,0.04))',
          }}
        >
          <button
            onClick={() => update(Math.max(0, qty - 1))}
            disabled={pending}
            aria-label="Diminuer la quantité"
            className="h-10 w-10 rounded-full flex items-center justify-center text-lg font-light transition-colors disabled:opacity-40"
            style={{ color: 'var(--ct-text-body, rgba(245,245,245,0.72))' }}
          >
            −
          </button>
          <span
            className="px-4 text-base font-medium tabular-nums"
            style={{ color: 'var(--ct-text-strong, #fff)' }}
          >
            {qty}
          </span>
          <button
            onClick={() => update(qty + 1)}
            disabled={pending}
            aria-label="Augmenter la quantité"
            className="h-10 w-10 rounded-full flex items-center justify-center text-lg font-light transition-colors disabled:opacity-40"
            style={{ color: 'var(--ct-text-body, rgba(245,245,245,0.72))' }}
          >
            +
          </button>
        </div>
        {error && (
          <p
            className="mt-2 text-xs"
            style={{ color: 'var(--ct-danger, #f87171)' }}
          >
            {error}
          </p>
        )}
      </td>
      <td
        className="p-6 text-right text-base font-medium"
        style={{ color: 'var(--ct-text-primary, rgba(245,245,245,0.92))' }}
      >
        {formatMoney(item.total, currency)}
      </td>
      <td className="p-6 text-right">
        <button
          onClick={() => setConfirmRemove(true)}
          disabled={pending}
          aria-label={`Retirer ${item.title}`}
          className="text-sm transition-colors hover:opacity-100"
          style={{ color: 'var(--ct-text-muted, rgba(245,245,245,0.48))' }}
        >
          Retirer
        </button>
        <ConfirmDialog
          open={confirmRemove}
          title="Retirer cet article ?"
          description={`${item.title} sera retiré de votre panier.`}
          confirmLabel="Retirer"
          cancelLabel="Annuler"
          tone="destructive"
          onConfirm={() => {
            setConfirmRemove(false);
            update(0);
          }}
          onCancel={() => setConfirmRemove(false)}
        />
      </td>
    </tr>
  );
}
