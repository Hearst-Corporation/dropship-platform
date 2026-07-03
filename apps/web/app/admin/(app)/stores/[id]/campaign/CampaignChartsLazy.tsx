"use client";

import nextDynamic from "next/dynamic";

/**
 * `next/dynamic` with `ssr:false` must be called from a Client Component —
 * Next.js rejects it directly inside a Server Component. This wrapper is the
 * client boundary; `page.tsx` (a Server Component) imports from here instead
 * of calling `nextDynamic` itself, keeping recharts out of the initial bundle.
 */
export const PlatformSplitDonut = nextDynamic(
  () => import("./CampaignCharts").then((mod) => mod.PlatformSplitDonut),
  { ssr: false },
);
export const KpiComparisonChart = nextDynamic(
  () => import("./CampaignCharts").then((mod) => mod.KpiComparisonChart),
  { ssr: false },
);
