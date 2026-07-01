'use client';

import { useEffect, useRef, useState } from 'react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'default' | 'destructive';
  /**
   * Confirm handler. May be sync or async. While the returned promise is
   * pending, the confirm button is disabled and shows a busy label — guards
   * against double-submit (Enter spam, rapid clicks) on slow actions like
   * AE mark-paid, store delete, or order forward.
   */
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  tone = 'default',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  const [confirming, setConfirming] = useState(false);
  const confirmingRef = useRef(false);

  // Keep the ref in sync with state without mutating during render
  // (avoids react-hooks/refs). The ref lets the keydown handler read the
  // latest busy status without re-subscribing on every state change.
  useEffect(() => {
    confirmingRef.current = confirming;
  }, [confirming]);

  useEffect(() => {
    if (!open) {
      setConfirming(false);
      return;
    }
    confirmRef.current?.focus();
    const runConfirm = async () => {
      if (confirmingRef.current) return;
      confirmingRef.current = true;
      setConfirming(true);
      try {
        await onConfirm();
      } finally {
        setConfirming(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (confirmingRef.current) return;
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Enter') {
        e.preventDefault();
        void runConfirm();
      }
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onCancel, onConfirm]);

  if (!open) return null;

  const handleConfirm = async () => {
    if (confirmingRef.current) return;
    confirmingRef.current = true;
    setConfirming(true);
    try {
      await onConfirm();
    } finally {
      setConfirming(false);
    }
  };

  const confirmStyle: React.CSSProperties =
    tone === 'destructive'
      ? {
          background: 'var(--ct-accent-strong)',
          color: 'var(--ct-text-strong)',
        }
      : {
          background: 'var(--ct-surface-3)',
          color: 'var(--ct-text-primary)',
          border: '1px solid var(--ct-border-strong)',
        };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby={description ? 'confirm-dialog-description' : undefined}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-zinc-950/65 backdrop-blur-sm"
        onClick={() => {
          if (!confirming) onCancel();
        }}
      />
      {/* Dialog panel */}
      <div
        className="relative rounded-xl max-w-md w-full p-6"
        style={{
          background: 'var(--ct-surface-2)',
          border: '1px solid var(--ct-border-strong)',
          boxShadow: 'var(--ct-shadow-depth)',
        }}
      >
        <h2
          id="confirm-dialog-title"
          className="text-base font-semibold leading-snug"
          style={{ color: 'var(--ct-text-primary)' }}
        >
          {title}
        </h2>
        {description && (
          <p
            id="confirm-dialog-description"
            className="mt-2 text-sm leading-relaxed whitespace-pre-wrap"
            style={{ color: 'var(--ct-text-body)' }}
          >
            {description}
          </p>
        )}
        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={confirming}
            className="px-4 py-2 rounded-lg text-sm font-medium focus-visible:outline-hidden disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              color: 'var(--ct-text-body)',
              transition: 'background var(--ct-dur-base) var(--ct-ease)',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'var(--ct-surface-3)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
            }}
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={handleConfirm}
            disabled={confirming}
            className="px-4 py-2 rounded-lg text-sm font-medium focus-visible:outline-hidden disabled:opacity-70 disabled:cursor-not-allowed"
            style={{
              ...confirmStyle,
              transition: 'opacity var(--ct-dur-base) var(--ct-ease)',
            }}
          >
            {confirming ? 'En cours…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
