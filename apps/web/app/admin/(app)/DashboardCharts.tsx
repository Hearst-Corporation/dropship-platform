'use client';

import AdminTrendChart from '@/components/admin/AdminTrendChart';
import AdminFunnelChart from '@/components/admin/AdminFunnelChart';

/**
 * Client-only chart wrappers for the portfolio dashboard. The server page owns
 * all data fetching and passes down already-serialized rows (numbers, not
 * bigint/text) — this component only renders them with Recharts.
 */
export interface DashboardTrendPoint {
  label: string;
  /** CA du jour en euros (déjà converti depuis les centimes). */
  ca: number;
  /** Nombre de commandes du jour. */
  commandes: number;
  /** Index signature so the row is assignable to the chart's Record data prop. */
  [key: string]: string | number;
}

export interface DashboardFunnelStep {
  label: string;
  value: number;
}

export function DashboardTrend({ data }: { data: DashboardTrendPoint[] }) {
  return (
    <AdminTrendChart
      data={data}
      xKey="label"
      series={[
        { key: 'ca', label: 'CA (€)' },
        { key: 'commandes', label: 'Commandes' },
      ]}
      height={280}
    />
  );
}

export function DashboardFunnel({ steps }: { steps: DashboardFunnelStep[] }) {
  return <AdminFunnelChart steps={steps} height={260} />;
}
