"use client";

import { apiFetch } from "@/lib/client-fetch";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useUnsavedChanges } from "@/lib/use-unsaved-changes";
import { AdminSection } from "@/components/admin/AdminSection";
import { Button } from "@/components/catalyst/button";
import {
  Fieldset,
  Legend,
  FieldGroup,
  Field,
  Label,
  Description,
} from "@/components/catalyst/fieldset";
import { Input } from "@/components/catalyst/input";
import { Text } from "@/components/catalyst/text";

interface InitialValues {
  ga4MeasurementId: string;
  ga4ApiSecret: string;
  metaPixelId: string;
  metaCapiToken: string;
  tiktokPixelId: string;
  tiktokEventsToken: string;
  clarityId: string;
  googleAdsConversionAction: string;
  googleAdsMerchantId: string;
}

interface Props {
  storeId: string;
  initial: InitialValues;
}

/**
 * Admin form to manage per-store analytics IDs. Three groups:
 *   - Acquisition (UA): GA4 + Meta Pixel + TikTok Pixel — public IDs that
 *     get injected into the storefront on every visit.
 *   - Server-side dedup: Meta CAPI + TikTok Events tokens — sensitive,
 *     used by the server to forward purchase events bypassing ad blockers.
 *   - UX: Microsoft Clarity ID for session replays + heatmaps.
 *
 * Empty string clears a previously-set value, undefined leaves it untouched.
 */
export function StoreAnalyticsForm({ storeId, initial }: Props) {
  const [values, setValues] = useState<InitialValues>(initial);
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{
    type: "ok" | "err";
    msg: string;
  } | null>(null);
  const router = useRouter();
  const dirty = useMemo(
    () =>
      (Object.keys(values) as (keyof InitialValues)[]).some(
        (k) => values[k] !== initial[k],
      ),
    [values, initial],
  );
  useUnsavedChanges(dirty && !pending);

  const set =
    (k: keyof InitialValues) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setValues((v) => ({ ...v, [k]: e.target.value }));

  function submit() {
    setFeedback(null);
    startTransition(async () => {
      try {
        const res = await apiFetch(`/api/agent/stores/${storeId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ analytics: values }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || "Erreur");
        setFeedback({ type: "ok", msg: "Mis à jour." });
        router.refresh();
      } catch (e) {
        setFeedback({
          type: "err",
          msg: e instanceof Error ? e.message : "Erreur",
        });
      }
    });
  }

  return (
    <AdminSection
      title="Analytics & attribution"
      description="Les pixels et tags injectés sur la boutique. Tous facultatifs, tous propres à ce store."
    >
      <div className="space-y-8">
        <Fieldset>
          <Legend>Acquisition (UA)</Legend>
          <Text>Pixels client-side. Indispensables pour les ads.</Text>
          <FieldGroup>
            <AnalyticsField
              label="Google Analytics 4"
              id="ga4"
              placeholder="G-XXXXXXXXXX"
              value={values.ga4MeasurementId}
              onChange={set("ga4MeasurementId")}
              help="Measurement ID. Trouvé dans Admin → Streams → Web."
            />
            <AnalyticsField
              label="Meta Pixel ID"
              id="meta"
              placeholder="123456789012345"
              value={values.metaPixelId}
              onChange={set("metaPixelId")}
              help="Numérique, 15-16 chiffres. Events Manager → Data Sources."
            />
            <AnalyticsField
              label="TikTok Pixel ID"
              id="tiktok"
              placeholder="C..."
              value={values.tiktokPixelId}
              onChange={set("tiktokPixelId")}
              help="Préfixe C. Ads Manager → Assets → Events."
            />
          </FieldGroup>
        </Fieldset>

        <Fieldset>
          <Legend>Server-side dedup (CAPI / Events API)</Legend>
          <Text>
            Tokens secrets, chiffrés (AES-256-GCM) côté serveur. N&apos;utilise
            que ceux de cette boutique.
          </Text>
          <FieldGroup>
            <AnalyticsField
              label="Meta Conversions API token"
              id="meta-capi"
              type="password"
              placeholder="EAA..."
              value={values.metaCapiToken}
              onChange={set("metaCapiToken")}
              help="Events Manager → ton pixel → Settings → Generate access token."
            />
            <AnalyticsField
              label="TikTok Events API access token"
              id="tiktok-events"
              type="password"
              placeholder="..."
              value={values.tiktokEventsToken}
              onChange={set("tiktokEventsToken")}
              help="Ads Manager → Events → Web Events → Settings → Manage Events API."
            />
            <AnalyticsField
              label="GA4 Measurement Protocol API secret"
              id="ga4-api-secret"
              type="password"
              placeholder="abcDEF123..."
              value={values.ga4ApiSecret}
              onChange={set("ga4ApiSecret")}
              help="GA4 Admin → Data Streams → ton stream Web → Measurement Protocol API secrets → Create."
            />
          </FieldGroup>
        </Fieldset>

        <Fieldset>
          <Legend>Comportement (UX)</Legend>
          <Text>Replays de session, heatmaps. Gratuit, RGPD-friendly.</Text>
          <FieldGroup>
            <AnalyticsField
              label="Microsoft Clarity Project ID"
              id="clarity"
              placeholder="abcd1234ef"
              value={values.clarityId}
              onChange={set("clarityId")}
              help="clarity.microsoft.com → projet → Settings → Setup."
            />
          </FieldGroup>
        </Fieldset>

        <Fieldset>
          <Legend>Google Ads</Legend>
          <Text>
            Remontée des conversions offline. Contourne les bloqueurs côté
            client.
          </Text>
          <FieldGroup>
            <AnalyticsField
              label="Conversion Action"
              id="google-ads-conversion-action"
              placeholder="customers/2877134493/conversionActions/…"
              value={values.googleAdsConversionAction}
              onChange={set("googleAdsConversionAction")}
              help="Google Ads → Objectifs → Conversions → sélectionne l'action → champ Nom de ressource."
            />
            <AnalyticsField
              label="Merchant Center ID"
              id="google-merchant-id"
              placeholder="5784865611"
              value={values.googleAdsMerchantId}
              onChange={set("googleAdsMerchantId")}
              help="Merchant Center → Paramètres du compte → Numéro d'ID."
            />
          </FieldGroup>
        </Fieldset>

        <div className="flex items-center justify-between gap-4 border-t border-admin-border pt-4 border-admin-border">
          {feedback ? (
            feedback.type === "ok" ? (
              <span className="text-sm text-indigo-400">{feedback.msg}</span>
            ) : (
              <span className="text-sm font-medium text-white">
                Erreur : {feedback.msg}
              </span>
            )
          ) : dirty ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-zinc-500 text-zinc-400">
              <span className="h-1.5 w-1.5 rounded-full bg-admin-surface-dot" />
              Non sauvegardé
            </span>
          ) : (
            <span className="text-xs text-zinc-500 text-zinc-400">
              Champ vide → la valeur est effacée. Champ inchangé → conservé.
            </span>
          )}
          <Button
            type="button"
            color="indigo"
            onClick={submit}
            disabled={pending || !dirty}
          >
            {pending ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </div>
      </div>
    </AdminSection>
  );
}

function AnalyticsField({
  label,
  id,
  value,
  onChange,
  placeholder,
  help,
  type = "text",
}: {
  label: string;
  id: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  help?: string;
  type?: "text" | "password";
}) {
  return (
    <Field>
      <Label>{label}</Label>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        className="font-mono"
      />
      {help && <Description>{help}</Description>}
    </Field>
  );
}
