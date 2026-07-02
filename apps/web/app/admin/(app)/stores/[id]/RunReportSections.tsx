import { Fragment } from "react";
import { Subheading } from "@/components/catalyst/heading";
import { Text } from "@/components/catalyst/text";
import { Badge } from "@/components/catalyst/badge";
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeader,
  TableCell,
} from "@/components/catalyst/table";
import {
  DescriptionList,
  DescriptionTerm,
  DescriptionDetails,
} from "@/components/catalyst/description-list";
import { AdminBadge } from "@/components/admin/AdminBadge";
import { AdminDataTable } from "@/components/admin/AdminDataTable";
import type { StoreRunReport } from "@/lib/agent/store-report";

const RISK_LABEL: Record<string, string> = {
  low: "Faible",
  medium: "Moyen",
  high: "Élevé",
  unknown: "Non évalué",
};

const PRODUCT_STATUS_LABEL: Record<string, string> = {
  imported: "Importé",
  import_failed: "Import échoué",
  local_only: "Local (Medusa hors ligne)",
  proposed: "Proposé",
};

const ASSET_STATUS_LABEL: Record<string, string> = {
  generated: "Assets générés",
  "supplier-images": "Photos fournisseur",
  placeholder: "Visuels de secours",
  pending_generation: "Génération en attente",
};

function eur(cents: number): string {
  return `${(cents / 100).toFixed(2)} €`;
}

/**
 * Report-driven sections of the store detail page: supplier policy outcome,
 * per-product risk/status, the staged Google Ads plan and the agent run log.
 * Renders nothing when the store has no persisted run report (legacy stores).
 */
export function RunReportSections({
  report,
}: {
  report: StoreRunReport | null;
}) {
  if (!report) return null;

  const suppliersSorted = [...report.suppliers].sort((a, b) => {
    const w = (s: typeof a) =>
      s.productsFound > 0
        ? 0
        : s.considered
          ? 1
          : s.status === "automation"
            ? 2
            : 3;
    return w(a) - w(b);
  });

  const plan = report.adsPlan;

  return (
    <>
      <section className="border-t border-white/[0.08] pt-8">
        <div className="flex items-start justify-between gap-4">
          <Subheading>Run agent</Subheading>
          <AdminBadge status={report.assets.status}>
            {ASSET_STATUS_LABEL[report.assets.status] ?? report.assets.status}
          </AdminBadge>
        </div>
        <DescriptionList className="mt-4 sm:grid-cols-2">
          <DescriptionTerm>Marchés cibles</DescriptionTerm>
          <DescriptionDetails>
            {report.markets.join(" + ") || "FR"}
          </DescriptionDetails>

          <DescriptionTerm>Template storefront</DescriptionTerm>
          <DescriptionDetails>{report.template || "auto"}</DescriptionDetails>

          <DescriptionTerm>Visuels</DescriptionTerm>
          <DescriptionDetails>
            {report.assets.notes || ASSET_STATUS_LABEL[report.assets.status]}
          </DescriptionDetails>

          {report.brief && (
            <>
              <DescriptionTerm>Brief opérateur</DescriptionTerm>
              <DescriptionDetails className="whitespace-pre-wrap">
                {report.brief}
              </DescriptionDetails>
            </>
          )}
        </DescriptionList>
      </section>

      <section className="border-t border-white/[0.08] pt-8">
        <Subheading>Fournisseurs et dropshippers</Subheading>
        <Text className="mt-1">
          Politique appliquée pendant le run: sources interrogées, plateformes
          exclues et justification.
        </Text>
        <AdminDataTable className="mt-4">
          <Table dense>
            <TableHead>
              <TableRow>
                <TableHeader>Fournisseur</TableHeader>
                <TableHeader>Statut</TableHeader>
                <TableHeader className="text-right hidden sm:table-cell">
                  Produits
                </TableHeader>
                <TableHeader className="hidden md:table-cell">
                  Raison
                </TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {suppliersSorted.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium text-white">
                    {s.label}
                  </TableCell>
                  <TableCell>
                    <AdminBadge
                      status={s.productsFound > 0 ? "active" : s.status}
                    >
                      {s.productsFound > 0
                        ? "Utilisé"
                        : s.status === "excluded"
                          ? "Exclu"
                          : s.status === "automation"
                            ? "Automation"
                            : s.considered
                              ? "Interrogé"
                              : "Hors socle"}
                    </AdminBadge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums hidden sm:table-cell">
                    {s.productsFound || "—"}
                  </TableCell>
                  <TableCell className="max-w-md text-zinc-500 hidden md:table-cell">
                    <span className="line-clamp-2">{s.reason}</span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </AdminDataTable>
      </section>

      {report.products.length > 0 && (
        <section className="border-t border-white/[0.08] pt-8">
          <Subheading>Sélection produits du run</Subheading>
          <Text className="mt-1">
            Prix, coût, marge, risque et adéquation marché évalués par
            l&rsquo;agent.
          </Text>
          <AdminDataTable className="mt-4">
            <Table dense>
              <TableHead>
                <TableRow>
                  <TableHeader>Produit</TableHeader>
                  <TableHeader className="hidden sm:table-cell">
                    Fournisseur
                  </TableHeader>
                  <TableHeader className="text-right">Prix</TableHeader>
                  <TableHeader className="text-right hidden md:table-cell">
                    Coût
                  </TableHeader>
                  <TableHeader className="text-right hidden md:table-cell">
                    Marge
                  </TableHeader>
                  <TableHeader className="hidden lg:table-cell">
                    Risque
                  </TableHeader>
                  <TableHeader className="hidden lg:table-cell">
                    Marché
                  </TableHeader>
                  <TableHeader>Statut</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {report.products.map((p) => (
                  <TableRow key={`${p.supplier}-${p.externalId}`}>
                    <TableCell className="max-w-xs">
                      <span className="line-clamp-1 font-medium text-white">
                        {p.title}
                      </span>
                      <span className="mt-0.5 line-clamp-1 block text-xs text-zinc-500">
                        {p.reason}
                      </span>
                    </TableCell>
                    <TableCell className="text-zinc-500 hidden sm:table-cell">
                      {p.supplier}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-white">
                      {eur(p.priceCents)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums hidden md:table-cell">
                      {p.costCents > 0 ? eur(p.costCents) : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums hidden md:table-cell">
                      {p.marginPct != null ? `${p.marginPct}%` : "—"}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <AdminBadge
                        status={p.riskLevel === "low" ? "ok" : p.riskLevel}
                      >
                        {RISK_LABEL[p.riskLevel] ?? p.riskLevel}
                      </AdminBadge>
                    </TableCell>
                    <TableCell className="max-w-48 text-zinc-500 hidden lg:table-cell">
                      <span className="line-clamp-2">{p.marketFit}</span>
                    </TableCell>
                    <TableCell>
                      <AdminBadge
                        status={p.status === "imported" ? "active" : p.status}
                      >
                        {PRODUCT_STATUS_LABEL[p.status] ?? p.status}
                      </AdminBadge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </AdminDataTable>
        </section>
      )}

      {plan && (
        <section className="border-t border-white/[0.08] pt-8">
          <div className="flex items-start justify-between gap-4">
            <Subheading>Plan Google Ads de lancement</Subheading>
            <div className="flex items-center gap-2">
              <Badge color="zinc">Draft, non envoyé</Badge>
              <Badge color={plan.source === "openai" ? "indigo" : "zinc"}>
                {plan.source === "openai" ? "Généré par IA" : "Plan de secours"}
              </Badge>
            </div>
          </div>

          <DescriptionList className="mt-4 sm:grid-cols-2">
            <DescriptionTerm>Campagne</DescriptionTerm>
            <DescriptionDetails>{plan.campaignName}</DescriptionDetails>

            <DescriptionTerm>Objectif</DescriptionTerm>
            <DescriptionDetails>{plan.objective}</DescriptionDetails>

            <DescriptionTerm>Pays</DescriptionTerm>
            <DescriptionDetails>{plan.countries.join(", ")}</DescriptionDetails>

            <DescriptionTerm>Budget quotidien</DescriptionTerm>
            <DescriptionDetails>
              {plan.dailyBudgetEur} € / jour
            </DescriptionDetails>

            <DescriptionTerm>Audience</DescriptionTerm>
            <DescriptionDetails>{plan.audience}</DescriptionDetails>

            <DescriptionTerm>Landing</DescriptionTerm>
            <DescriptionDetails>{plan.landingPage}</DescriptionDetails>

            <DescriptionTerm>Mots-clés</DescriptionTerm>
            <DescriptionDetails>{plan.keywords.join(" · ")}</DescriptionDetails>

            <DescriptionTerm>Mots-clés négatifs</DescriptionTerm>
            <DescriptionDetails>
              {plan.negativeKeywords.join(" · ")}
            </DescriptionDetails>
          </DescriptionList>

          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div>
              <Text className="font-medium text-white!">
                Titres (RSA, max 30 car.)
              </Text>
              <ul className="mt-2 space-y-1">
                {plan.headlines.map((h, i) => (
                  <li key={i} className="text-sm text-zinc-500">
                    {i + 1}. {h}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <Text className="font-medium text-white!">
                Descriptions (max 90 car.)
              </Text>
              <ul className="mt-2 space-y-1">
                {plan.descriptions.map((d, i) => (
                  <li key={i} className="text-sm text-zinc-500">
                    {i + 1}. {d}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <DescriptionList className="mt-6 sm:grid-cols-2">
            <DescriptionTerm>Tracking</DescriptionTerm>
            <DescriptionDetails>
              {plan.trackingNotes.map((t, i) => (
                <Fragment key={i}>
                  {i > 0 && <br />}
                  {t}
                </Fragment>
              ))}
            </DescriptionDetails>

            <DescriptionTerm>Risques policy</DescriptionTerm>
            <DescriptionDetails>
              {plan.policyRisks.map((r, i) => (
                <Fragment key={i}>
                  {i > 0 && <br />}
                  {r}
                </Fragment>
              ))}
            </DescriptionDetails>

            <DescriptionTerm>Prochaines étapes</DescriptionTerm>
            <DescriptionDetails>
              {plan.nextSteps.map((s, i) => (
                <Fragment key={i}>
                  {i > 0 && <br />}
                  {i + 1}. {s}
                </Fragment>
              ))}
            </DescriptionDetails>
          </DescriptionList>
        </section>
      )}

      {report.events.length > 0 && (
        <section className="border-t border-white/[0.08] pt-8">
          <Subheading>Logs du run agent</Subheading>
          <div className="mt-4 max-h-80 overflow-y-auto rounded-lg p-4 ring-1 ring-white/[0.08]">
            <div className="flex flex-col gap-1 font-mono text-xs">
              {report.events.map((e, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="shrink-0 tabular-nums text-zinc-500">
                    {e.ts.slice(11, 19)}
                  </span>
                  <span
                    className={
                      e.type === "error"
                        ? "font-medium text-white"
                        : e.type === "success"
                          ? "text-indigo-400"
                          : e.type === "step"
                            ? "font-medium text-white"
                            : "text-zinc-500"
                    }
                  >
                    {e.message}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
