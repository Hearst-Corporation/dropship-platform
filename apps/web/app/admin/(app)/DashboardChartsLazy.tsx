"use client";

import nextDynamic from "next/dynamic";

/**
 * `next/dynamic` with `ssr:false` must be called from a Client Component —
 * Next.js rejects it directly inside a Server Component. This wrapper is the
 * client boundary; `page.tsx` (a Server Component) imports from here instead
 * of calling `nextDynamic` itself, keeping recharts out of the initial bundle.
 */
export const DashboardTrend = nextDynamic(
  () => import("./DashboardCharts").then((mod) => mod.DashboardTrend),
  { ssr: false },
);
export const DashboardFunnel = nextDynamic(
  () => import("./DashboardCharts").then((mod) => mod.DashboardFunnel),
  { ssr: false },
);
