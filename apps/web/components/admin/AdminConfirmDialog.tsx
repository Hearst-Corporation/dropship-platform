"use client";

import { useEffect, useRef, useState } from "react";
import {
  Alert,
  AlertActions,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

/**
 * Confirmation dialog for admin actions, built on Catalyst Alert + Button
 * (same props API as components/ui/confirm-dialog so call sites swap 1:1,
 * but without the legacy cockpit --ct-* tokens; the storefront keeps its own
 * dialog). Catalyst handles Escape, backdrop and scroll lock; focus and
 * Enter-to-confirm are wired below to match the dialog it replaces.
 *
 * The confirm handler may be async: while pending the confirm button is
 * disabled and shows a busy label, guarding against double-submit on slow
 * actions (mark-paid, store delete, order forward).
 *
 * Single-accent policy means `destructive` can't use a danger hue: it gets
 * the solid indigo accent (loud, filled) while `default` stays outline —
 * quieter, but still distinguishable at a glance from a routine primary CTA
 * elsewhere in the admin (which is solid indigo). Confirm label text is what
 * ultimately signals severity ("Supprimer" vs "Confirmer").
 */
export interface AdminConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "destructive";
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

export function AdminConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirmer",
  cancelLabel = "Annuler",
  tone = "default",
  onConfirm,
  onCancel,
}: AdminConfirmDialogProps) {
  const [confirming, setConfirming] = useState(false);
  const confirmingRef = useRef(false);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  const handleConfirm = async () => {
    if (confirmingRef.current) return;
    confirmingRef.current = true;
    setConfirming(true);
    try {
      await onConfirm();
    } finally {
      confirmingRef.current = false;
      setConfirming(false);
    }
  };

  // Match the dialog this replaces: focus the confirm action on open, and
  // let Enter confirm (Escape-to-cancel is already handled by Catalyst Alert).
  useEffect(() => {
    if (!open) return;
    confirmButtonRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || confirmingRef.current) return;
      e.preventDefault();
      void handleConfirm();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Alert
      open={open}
      onClose={confirming ? () => {} : onCancel}
      size="sm"
      className="dark"
    >
      <AlertTitle>{title}</AlertTitle>
      {description ? <AlertDescription>{description}</AlertDescription> : null}
      <AlertActions>
        <Button plain onClick={onCancel} disabled={confirming}>
          {cancelLabel}
        </Button>
        <Button
          ref={confirmButtonRef}
          {...(tone === "destructive"
            ? { color: "indigo" as const }
            : { outline: true as const })}
          onClick={() => void handleConfirm()}
          disabled={confirming}
        >
          {confirming ? "En cours…" : confirmLabel}
        </Button>
      </AlertActions>
    </Alert>
  );
}
