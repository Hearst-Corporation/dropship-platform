'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { TrashIcon } from '@heroicons/react/24/outline';
import { Button } from '@/components/catalyst/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

export function StoreActions({
  storeId,
  storeName,
  compact = false,
}: {
  storeId: string;
  storeName: string;
  compact?: boolean;
}) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const router = useRouter();

  const runDelete = async () => {
    setConfirmOpen(false);
    setDeleting(true);
    setError(null);
    try {
      const base = typeof window !== 'undefined' ? window.location.origin : '';
      const res = await fetch(`${base}/api/agent/stores/${storeId}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error || `HTTP ${res.status}`);
        return;
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur réseau');
    } finally {
      setDeleting(false);
    }
  };

  const iconCls = compact ? 'size-3.5' : 'size-4';
  return (
    <>
      <Button
        plain
        type="button"
        onClick={() => setConfirmOpen(true)}
        disabled={deleting}
        aria-label={`Supprimer ${storeName}`}
        title={error || `Supprimer ${storeName}`}
        className={error ? 'text-zinc-500' : undefined}
      >
        <TrashIcon className={iconCls} aria-hidden />
      </Button>
      <ConfirmDialog
        open={confirmOpen}
        title={`Supprimer le store « ${storeName} » ?`}
        description="Cette action supprimera aussi tous ses produits Medusa. Elle est irréversible."
        confirmLabel="Supprimer"
        tone="destructive"
        onConfirm={runDelete}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}
