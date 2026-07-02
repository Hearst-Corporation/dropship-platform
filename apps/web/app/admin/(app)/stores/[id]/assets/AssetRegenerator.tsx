"use client";

import { apiFetch } from "@/lib/client-fetch";

/**
 * Client component rendering one asset section (current preview, regen panel,
 * history strip). One instance per asset kind on the page. The SSE log lines
 * read the same `{type, message}` event shape as `/admin/stores/new`.
 */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { AssetKind } from "@/lib/agent/asset-regenerator";
import { Text, TextLink } from "@/components/catalyst/text";
import { Badge } from "@/components/catalyst/badge";
import { Button } from "@/components/catalyst/button";
import { Textarea } from "@/components/catalyst/textarea";
import {
  Fieldset,
  Field,
  Label,
  Description,
} from "@/components/catalyst/fieldset";

interface RunLite {
  id: string;
  prompt: string | null;
  resultUrl: string | null;
  status: "pending" | "running" | "success" | "error";
  errorMessage: string | null;
  isCurrent: boolean;
  createdAt: string;
}

interface AgentEvent {
  type: "step" | "progress" | "success" | "error" | "done";
  message: string;
  data?: Record<string, unknown>;
}

interface LogLine {
  id: number;
  type: AgentEvent["type"];
  message: string;
  ts: string;
}

export const ASSET_KIND_LABELS: Record<AssetKind, { title: string; hint: string }> = {
  hero: {
    title: "Hero",
    hint: "Plein cadre éditorial 16:9 servi en haut du storefront.",
  },
  cutout: {
    title: "Cutout",
    hint: "Produit centré sur fond studio sombre. Sert aussi de source à la vidéo promo.",
  },
  "lifestyle-1": {
    title: "Lifestyle 1",
    hint: "Premier moment de vie : contexte intérieur lumineux.",
  },
  "lifestyle-2": {
    title: "Lifestyle 2",
    hint: "Deuxième moment de vie : contexte extérieur ou alternatif.",
  },
  "lifestyle-3": {
    title: "Lifestyle 3",
    hint: "Troisième moment de vie : usage situé, distinct des deux précédents.",
  },
  promo: {
    title: "Vidéo promo",
    hint: "5 secondes 9:16, image-to-video à partir du cutout.",
  },
};

function formatRunDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function AssetRegenerator({
  storeId,
  kind,
  currentUrl,
  runs,
  referenceImageUrl,
}: {
  storeId: string;
  kind: AssetKind;
  currentUrl: string | null;
  runs: RunLite[];
  referenceImageUrl: string | null;
}) {
  const router = useRouter();
  const label = ASSET_KIND_LABELS[kind];
  const isVideo = kind === "promo";

  // Pre-fill the prompt textarea with the last used prompt, falling back to ''
  // so the user can write from scratch.
  const lastPrompt = runs.find((r) => r.prompt)?.prompt ?? "";

  const [panelOpen, setPanelOpen] = useState(false);
  const [prompt, setPrompt] = useState(lastPrompt);
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pendingSetId, setPendingSetId] = useState<string | null>(null);
  const counterRef = useRef(0);
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logs.length > 0) {
      logsEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [logs.length]);

  const pushLog = (type: AgentEvent["type"], message: string) => {
    counterRef.current += 1;
    setLogs((prev) => [
      ...prev,
      {
        id: counterRef.current,
        type,
        message,
        ts: new Date().toLocaleTimeString("fr-FR", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
      },
    ]);
  };

  const launch = async () => {
    if (running) return;
    if (!referenceImageUrl) {
      setError("Aucune image produit de référence.");
      return;
    }
    setRunning(true);
    setError(null);
    setLogs([]);

    try {
      const res = await apiFetch(
        `/api/agent/stores/${storeId}/assets/regenerate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind,
            customPrompt: prompt.trim() || undefined,
          }),
        },
      );
      if (!res.ok || !res.body) {
        const t = await res.text().catch(() => "");
        throw new Error(`Erreur serveur (${res.status}). ${t}`.trim());
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";
        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith("data:")) continue;
          try {
            const event = JSON.parse(line.slice(5).trim()) as AgentEvent;
            pushLog(event.type, event.message);
            if (event.type === "error") setError(event.message);
            if (event.type === "done") {
              router.refresh();
            }
          } catch {
            /* ignore malformed SSE chunk */
          }
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur réseau");
    } finally {
      setRunning(false);
    }
  };

  const setAsCurrent = async (runId: string) => {
    setError(null);
    setPendingSetId(runId);
    try {
      const res = await apiFetch(`/api/agent/stores/${storeId}/assets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId, kind }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error || "Erreur");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setPendingSetId(null);
    }
  };

  const successRuns = runs.filter((r) => r.status === "success" && r.resultUrl);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-end gap-4">
        <div className="flex shrink-0 items-center gap-2">
          {!referenceImageUrl && (
            <Text className="max-w-[16rem] text-right text-xs text-gray-500">
              Génère d&apos;abord un cutout produit
            </Text>
          )}
          <Button
            type="button"
            color="indigo"
            onClick={() => setPanelOpen((v) => !v)}
            disabled={running || !referenceImageUrl}
            title={
              !referenceImageUrl
                ? "Génère d’abord un cutout produit"
                : undefined
            }
            className="shrink-0"
          >
            {panelOpen ? "Fermer" : "Régénérer"}
          </Button>
        </div>
      </div>

      <div className="space-y-5">
        <div className="grid grid-cols-1 gap-6 2xl:grid-cols-[18rem_minmax(0,1fr)]">
          {/* Current preview */}
          <div>
            <Text className="mb-2 text-xs font-medium uppercase tracking-wide">
              Version courante
            </Text>
            {currentUrl ? (
              <TextLink
                href={currentUrl}
                target="_blank"
                rel="noreferrer"
                className="block overflow-hidden rounded-lg bg-admin-surface-panel ring-1 ring-admin-ring no-underline transition-colors hover:ring-admin-ring-strong"
              >
                {isVideo ? (
                  <video
                    src={currentUrl}
                    muted
                    playsInline
                    controls
                    className="aspect-square w-full bg-black object-cover"
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={currentUrl}
                    alt={label.title}
                    className="aspect-square w-full object-cover"
                  />
                )}
              </TextLink>
            ) : (
              <div className="flex aspect-square items-center justify-center rounded-lg border border-dashed border-admin-border-soft bg-admin-surface-inset text-xs text-zinc-500">
                Pas encore généré
              </div>
            )}
          </div>

          {/* Regen panel */}
          {panelOpen && (
            <div className="min-w-0 space-y-3">
              <Fieldset>
                <Field>
                  <Label className="text-xs font-medium uppercase tracking-wide">
                    Prompt FLUX (anglais, sans texte/badges)
                  </Label>
                  <Textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    disabled={running}
                    rows={5}
                    placeholder="Laisse vide pour laisser Claude rédiger un nouveau prompt..."
                    className="font-mono"
                  />
                  <Description className="text-xs">
                    Vide = Claude réécrit le prompt à partir du produit et de la
                    niche.
                  </Description>
                </Field>
              </Fieldset>
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  color="indigo"
                  onClick={launch}
                  disabled={running || !referenceImageUrl}
                >
                  {running ? "Génération en cours…" : "Lancer"}
                </Button>
                {error && (
                  <Text className="text-xs text-gray-400">{error}</Text>
                )}
              </div>

              {logs.length > 0 && (
                <div className="max-h-56 min-w-0 space-y-1 overflow-y-auto break-words rounded-lg bg-admin-surface-panel p-3 font-mono text-xs text-zinc-400 ring-1 ring-admin-ring">
                  {logs.map((l) => (
                    <div
                      key={l.id}
                      className={
                        l.type === "error"
                          ? "text-gray-400"
                          : l.type === "success"
                            ? "text-indigo-400"
                            : l.type === "step"
                              ? "text-white"
                              : "text-zinc-400"
                      }
                    >
                      <span className="text-zinc-500">[{l.ts}]</span>{" "}
                      {l.message}
                    </div>
                  ))}
                  <div ref={logsEndRef} />
                </div>
              )}
            </div>
          )}
        </div>

        {/* History strip */}
        <div>
          <Text className="mb-2 text-xs font-medium uppercase tracking-wide">
            Historique des runs ({runs.length})
          </Text>
          {runs.length === 0 ? (
            <Text className="text-xs italic">
              Aucune régénération enregistrée.
            </Text>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {runs.map((r) => {
                const usable = r.status === "success" && r.resultUrl;
                return (
                  <div
                    key={r.id}
                    className={
                      r.isCurrent
                        ? "overflow-hidden rounded-lg bg-admin-surface-inset ring-2 ring-indigo-500"
                        : "overflow-hidden rounded-lg bg-admin-surface-inset ring-1 ring-admin-ring"
                    }
                  >
                    <div className="relative aspect-square bg-admin-surface-panel">
                      {usable ? (
                        isVideo ? (
                          <video
                            src={r.resultUrl!}
                            muted
                            playsInline
                            className="h-full w-full bg-black object-cover"
                          />
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={r.resultUrl!}
                            alt={`Run du ${formatRunDate(r.createdAt)}`}
                            className="h-full w-full object-cover"
                          />
                        )
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs text-zinc-500">
                          {r.status === "error"
                            ? "Échec"
                            : r.status === "running"
                              ? "En cours…"
                              : "—"}
                        </div>
                      )}
                      {r.isCurrent && (
                        <span className="absolute left-1.5 top-1.5">
                          <Badge color="indigo">Courant</Badge>
                        </span>
                      )}
                    </div>
                    <div className="space-y-1.5 p-2">
                      <Text className="text-xs leading-snug">
                        Run du {formatRunDate(r.createdAt)}
                      </Text>
                      {r.prompt && (
                        <Text className="line-clamp-2 text-xs" title={r.prompt}>
                          {r.prompt}
                        </Text>
                      )}
                      {r.errorMessage && (
                        <Text
                          className="line-clamp-2 text-xs text-gray-400"
                          title={r.errorMessage}
                        >
                          {r.errorMessage}
                        </Text>
                      )}
                      {usable && !r.isCurrent && (
                        <Button
                          type="button"
                          plain
                          onClick={() => setAsCurrent(r.id)}
                          disabled={pendingSetId !== null}
                          aria-busy={pendingSetId === r.id}
                          className="w-full"
                        >
                          {pendingSetId === r.id
                            ? "…"
                            : "Définir comme courant"}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {successRuns.length === 0 && runs.length > 0 && (
            <Text className="mt-2 text-xs">
              Aucun run réussi pour le moment.
            </Text>
          )}
        </div>
      </div>
    </div>
  );
}
