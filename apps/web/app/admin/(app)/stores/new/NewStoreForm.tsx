"use client";

import { apiFetch } from "@/lib/client-fetch";

import { useState, useRef, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowTopRightOnSquareIcon,
} from "@heroicons/react/20/solid";
import { Heading, Subheading } from "@/components/catalyst/heading";
import { Text } from "@/components/catalyst/text";
import { AdminBadge } from "@/components/admin/AdminBadge";
import {
  Fieldset,
  FieldGroup,
  Field,
  Label,
  Description,
} from "@/components/catalyst/fieldset";
import { Input } from "@/components/catalyst/input";
import { Select } from "@/components/catalyst/select";
import { CheckboxField, Checkbox } from "@/components/catalyst/checkbox";
import { Button } from "@/components/catalyst/button";

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

function NewStoreForm() {
  const searchParams = useSearchParams();
  const [niche, setNiche] = useState("");
  const [storeName, setStoreName] = useState("");
  const [mode, setMode] = useState<"mono" | "collection">("mono");
  const [maxProducts] = useState(10);
  const [language, setLanguage] = useState<"fr" | "en">("fr");
  const [skipVideo, setSkipVideo] = useState(false);
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState<string>("");
  const [result, setResult] = useState<{
    slug: string;
    storeName: string;
    productCount: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const counterRef = useRef(0);
  const startTimeRef = useRef(0);

  // Prefill from query string (used by "recréer ce store" link)
  useEffect(() => {
    const n = searchParams.get("niche");
    const s = searchParams.get("name");
    if (n) setNiche(n);
    if (s) setStoreName(s);
  }, [searchParams]);

  // Elapsed timer
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setElapsed(Math.round((Date.now() - startTimeRef.current) / 1000));
    }, 500);
    return () => clearInterval(id);
  }, [running]);

  const addLog = (event: AgentEvent) => {
    const line: LogLine = {
      id: counterRef.current++,
      type: event.type,
      message: event.message,
      ts: new Date().toLocaleTimeString(),
    };
    setLogs((prev) => [...prev, line]);

    if (event.type === "step" || event.type === "progress") {
      setCurrentStep(event.message);
    }
    if (event.type === "step") setProgress((p) => Math.min(p + 12, 80));
    if (
      event.type === "progress" &&
      event.data?.imported &&
      event.data?.total
    ) {
      const pct = Math.round(
        (Number(event.data.imported) / Number(event.data.total)) * 100,
      );
      setProgress(70 + Math.round(pct * 0.27));
    }
    if (event.type === "success") {
      setProgress(100);
      setCurrentStep("");
    }
  };

  /**
   * Kick off store creation. Reads from local state by default, but an
   * `overrides` payload wins.
   */
  const launch = async (overrides?: {
    niche?: string;
    storeName?: string;
    mode?: "mono" | "collection";
    maxProducts?: number;
    language?: "fr" | "en";
    skipVideo?: boolean;
  }) => {
    const eff = {
      niche: overrides?.niche ?? niche,
      storeName: overrides?.storeName ?? storeName,
      mode: overrides?.mode ?? mode,
      maxProducts: overrides?.maxProducts ?? maxProducts,
      language: overrides?.language ?? language,
      skipVideo: overrides?.skipVideo ?? skipVideo,
    };
    if (!eff.niche.trim() || !eff.storeName.trim()) return;
    setRunning(true);
    setLogs([]);
    setResult(null);
    setError(null);
    setProgress(4);
    setCurrentStep("Démarrage…");
    setElapsed(0);
    startTimeRef.current = Date.now();
    setNiche(eff.niche);
    setStoreName(eff.storeName);
    setMode(eff.mode);

    try {
      const res = await apiFetch("/api/agent/create-store", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(eff),
      });

      if (!res.ok || !res.body) {
        setError("Erreur serveur. Vérifie OPENAI_API_KEY dans Réglages.");
        setRunning(false);
        return;
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
            addLog(event);
            if (event.type === "success" && event.data) {
              setResult({
                slug: event.data.slug as string,
                storeName: event.data.storeName as string,
                productCount: event.data.productCount as number,
              });
            }
            if (event.type === "error") setError(event.message);
          } catch {}
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur réseau");
    }
    setRunning(false);
  };

  const reset = () => {
    setResult(null);
    setError(null);
    setLogs([]);
    setProgress(0);
    setCurrentStep("");
    setElapsed(0);
    setNiche("");
    setStoreName("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    launch().catch((err) => {
      console.error("[launch] failed", err);
      setError(err instanceof Error ? err.message : "Erreur de lancement");
    });
  };

  const canSubmit =
    niche.trim().length > 0 && storeName.trim().length > 0 && !running;
  const isActive = running || !!result || !!error;

  const missingNiche = niche.trim().length === 0;
  const missingName = storeName.trim().length === 0;
  let disabledHint = "";
  if (missingNiche && missingName)
    disabledHint = "Renseigne une niche et un nom pour lancer la création.";
  else if (missingNiche)
    disabledHint = "Renseigne une niche pour lancer la création.";
  else if (missingName)
    disabledHint = "Renseigne un nom de store pour lancer la création.";

  return (
    <>
      {isActive ? (
        <CreationScreen
          running={running}
          percent={progress}
          elapsed={elapsed}
          currentStep={currentStep}
          storeName={storeName}
          logs={logs}
          result={result}
          error={error}
          onReset={reset}
          onRetry={() => {
            launch().catch((err) => {
              console.error("[retry] failed", err);
              setError(
                err instanceof Error ? err.message : "Erreur de lancement",
              );
            });
          }}
        />
      ) : (
        <div className="mx-auto w-full max-w-2xl space-y-6">
          <Subheading>Configurer le store</Subheading>
          <form onSubmit={handleSubmit}>
            <Fieldset>
              <FieldGroup>
                <Field>
                  <Label>Niche</Label>
                  <Description>
                    Le mot-clé produit ou thème autour duquel l’agent construit
                    le store.
                  </Description>
                  <Input
                    name="niche"
                    value={niche}
                    onChange={(e) => setNiche(e.target.value)}
                    placeholder="ex. lampes de bureau design"
                    autoFocus
                  />
                </Field>

                <Field>
                  <Label>Nom du store</Label>
                  <Input
                    name="storeName"
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    placeholder="ex. Lueur Studio"
                  />
                </Field>

                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <Field>
                    <Label>Mode</Label>
                    <Select
                      name="mode"
                      value={mode}
                      onChange={(e) =>
                        setMode(e.target.value as "mono" | "collection")
                      }
                    >
                      <option value="mono">Mono-produit</option>
                      <option value="collection">Collection</option>
                    </Select>
                  </Field>

                  <Field>
                    <Label>Langue</Label>
                    <Select
                      name="language"
                      value={language}
                      onChange={(e) =>
                        setLanguage(e.target.value as "fr" | "en")
                      }
                    >
                      <option value="fr">Français</option>
                      <option value="en">English</option>
                    </Select>
                  </Field>
                </div>

                <CheckboxField>
                  <Checkbox
                    name="skipVideo"
                    checked={skipVideo}
                    onChange={(checked) => setSkipVideo(checked)}
                  />
                  <Label>
                    Ignorer la génération vidéo (création plus rapide)
                  </Label>
                </CheckboxField>
              </FieldGroup>
            </Fieldset>

            <div className="mt-8 flex items-center justify-between gap-3 border-t border-admin-border pt-6 border-admin-border">
              <Text className="min-h-5 text-xs" aria-live="polite">
                {disabledHint}
              </Text>
              <div className="flex items-center gap-3">
                <Button plain href="/admin/stores">
                  Annuler
                </Button>
                <Button type="submit" color="indigo" disabled={!canSubmit}>
                  Créer le store
                </Button>
              </div>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

export { NewStoreForm };

function CreationScreen({
  running,
  percent,
  elapsed,
  currentStep,
  storeName,
  logs,
  result,
  error,
  onReset,
  onRetry,
}: {
  running: boolean;
  percent: number;
  elapsed: number;
  currentStep: string;
  storeName: string;
  logs: LogLine[];
  result: { slug: string; storeName: string; productCount: number } | null;
  error: string | null;
  onReset: () => void;
  onRetry: () => void;
}) {
  const logsEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs.length]);

  if (result) {
    return (
      <div className="mx-auto w-full max-w-2xl rounded-lg p-8 text-center ring-1 ring-admin-ring">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-indigo-500/10 ring-1 ring-indigo-500/20">
          <CheckCircleIcon
            className="size-7 text-indigo-500 text-indigo-400"
            aria-hidden="true"
          />
        </div>
        <Heading className="mt-4">{result.storeName}</Heading>
        <div className="mt-2 flex items-center justify-center gap-2">
          <AdminBadge status="prêt à vendre">Prêt à vendre</AdminBadge>
          <Text>
            {result.productCount} produit{result.productCount > 1 ? "s" : ""}{" "}
            importé
            {result.productCount > 1 ? "s" : ""}
          </Text>
        </div>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Button
            color="indigo"
            href={`/shop/${result.slug}`}
            target="_blank"
            rel="noreferrer"
          >
            Ouvrir le store
            <ArrowTopRightOnSquareIcon
              data-slot="icon"
              className="size-4"
              aria-hidden="true"
            />
          </Button>
          <Button plain href="/admin/stores">
            Voir tous les stores
          </Button>
          <Button plain type="button" onClick={onReset}>
            Créer un autre
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl overflow-hidden rounded-lg ring-1 ring-admin-ring">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between gap-4 border-b border-admin-border px-5 py-3 border-admin-border">
          <div className="flex min-w-0 items-center gap-3">
            <AdminBadge status={running ? "en cours" : "error"}>
              {running ? "En cours" : "Erreur"}
            </AdminBadge>
            <Subheading className="truncate">
              {running
                ? `Construction de « ${storeName} »`
                : `Erreur — « ${storeName} »`}
            </Subheading>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {running && (
              <Text className="tabular-nums">
                {percent}% &middot; {elapsed}s
              </Text>
            )}
            {error && (
              <>
                <Button plain type="button" onClick={onRetry}>
                  Réessayer
                </Button>
                <Button plain type="button" onClick={onReset}>
                  Créer un autre
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Barre de progression */}
        <div className="h-0.5 bg-admin-surface-inset">
          <div
            className="h-full bg-indigo-500 transition-[width] duration-500"
            style={{ width: `${Math.max(2, Math.min(100, percent))}%` }}
          />
        </div>

        {/* Étape courante */}
        {currentStep && (
          <div className="border-b border-admin-border bg-admin-surface-inset px-5 py-2">
            <Text className="truncate italic">{currentStep}</Text>
          </div>
        )}

        {/* Error banner */}
        {error && (
          <div className="border-b border-admin-border bg-admin-surface-panel px-5 py-3">
            <Text className="flex items-center gap-1.5 font-medium">
              <ExclamationTriangleIcon className="size-4" aria-hidden="true" />
              Erreur de création
            </Text>
            <Text className="mt-1 whitespace-pre-wrap text-zinc-400">
              {error}
            </Text>
          </div>
        )}

        {/* Logs en temps réel */}
        <div className="flex max-h-[60vh] min-h-64 flex-col gap-1.5 overflow-y-auto px-5 py-4 font-mono text-xs">
          {logs.map((l) => (
            <div key={l.id} className="flex items-start gap-3">
              <span className="shrink-0 pt-px tabular-nums text-zinc-500">
                {l.ts}
              </span>
              <span
                className={
                  l.type === "error"
                    ? "text-white"
                    : l.type === "success"
                      ? "text-indigo-400"
                      : l.type === "step"
                        ? "font-medium text-white"
                        : "text-zinc-500 text-zinc-400"
                }
              >
                {l.type === "step" && (
                  <span className="mr-1.5 text-zinc-500">&rsaquo;</span>
                )}
                {l.message}
              </span>
            </div>
          ))}
          {running && logs.length === 0 && (
            <p className="text-zinc-500">Démarrage&hellip;</p>
          )}
          <div ref={logsEndRef} />
        </div>
      </div>
    </div>
  );
}
