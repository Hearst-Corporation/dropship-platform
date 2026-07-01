'use client';

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

/**
 * Client-only projection charts for the store campaign page. The server page
 * passes the plan values (dailyBudgetEur, countries); everything here is a
 * deterministic projection computed from explicit hypotheses displayed under
 * each chart. Same palette and dark style as AdminTrendChart/AdminBarChart:
 * accent indigo (#6366f1) + secondary sky (#38bdf8), no new color.
 */

const ACCENT = '#6366f1';
const SECONDARY = '#38bdf8';
const AXIS_TICK = { fill: '#a1a1aa', fontSize: 12 };
const GRID_STROKE = 'rgba(255,255,255,0.08)';

/** Hypothèses de projection, affichées telles quelles sous les graphes. */
const REAL_SPEND_RATIO = 0.85;
const CPC_EUR = 0.45;
const CVR = 0.025;

export interface CampaignChartsProps {
  dailyBudgetEur: number;
  countries: string[];
}

function DarkTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number | string; color?: string }>;
  label?: string | number;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded border border-white/10 bg-zinc-800 px-3 py-2 text-xs text-zinc-100 shadow-lg">
      {label !== undefined && <div className="mb-1 font-medium text-zinc-300">{label}</div>}
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="inline-block size-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-zinc-400">{entry.name}</span>
          <span className="ml-auto font-medium tabular-nums">
            {typeof entry.value === 'number' ? entry.value.toLocaleString('fr-FR') : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}

function ChartBlock({
  title,
  note,
  children,
}: {
  title: string;
  note: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="text-sm/6 font-semibold text-zinc-950 dark:text-white">{title}</h3>
      <div className="mt-3">{children}</div>
      <p className="mt-2 text-xs/5 text-zinc-500 dark:text-zinc-400">{note}</p>
    </div>
  );
}

/** Répartition du budget: 100% si 1 pays, 60/40 si 2 pays, égale si plus. */
function splitBudget(dailyBudgetEur: number, countries: string[]): Array<{ country: string; budget: number }> {
  const list = countries.length > 0 ? countries : ['FR'];
  if (list.length === 1) {
    return [{ country: list[0], budget: Math.round(dailyBudgetEur * 100) / 100 }];
  }
  if (list.length === 2) {
    return [
      { country: list[0], budget: Math.round(dailyBudgetEur * 0.6 * 100) / 100 },
      { country: list[1], budget: Math.round(dailyBudgetEur * 0.4 * 100) / 100 },
    ];
  }
  const share = dailyBudgetEur / list.length;
  return list.map((country) => ({ country, budget: Math.round(share * 100) / 100 }));
}

function splitRuleLabel(countries: string[]): string {
  if (countries.length <= 1) return 'Règle appliquée: 100% du budget sur le seul pays ciblé.';
  if (countries.length === 2) return 'Règle appliquée: 60% sur le premier pays, 40% sur le second.';
  return `Règle appliquée: répartition égale entre les ${countries.length} pays ciblés.`;
}

export function CampaignCharts({ dailyBudgetEur, countries }: CampaignChartsProps) {
  const budget = Number.isFinite(dailyBudgetEur) && dailyBudgetEur > 0 ? dailyBudgetEur : 0;

  // a. Budget cumulé sur 30 jours: engagé vs hypothèse de dépense réelle (85%).
  const budgetData = Array.from({ length: 30 }, (_, i) => {
    const day = i + 1;
    const engaged = budget * day;
    return {
      jour: `J${day}`,
      engage: Math.round(engaged * 100) / 100,
      reel: Math.round(engaged * REAL_SPEND_RATIO * 100) / 100,
    };
  });

  // b. Répartition du budget quotidien par zone.
  const zoneData = splitBudget(budget, countries);

  // c. Clics et conversions estimés sur 30 jours.
  const trafficData = Array.from({ length: 30 }, (_, i) => {
    const day = i + 1;
    const spent = budget * day * REAL_SPEND_RATIO;
    const clicks = Math.round(spent / CPC_EUR);
    return {
      jour: `J${day}`,
      clics: clicks,
      conversions: Math.round(clicks * CVR * 10) / 10,
    };
  });

  return (
    <div className="space-y-8">
      <ChartBlock
        title="Projection de budget cumulé sur 30 jours"
        note={`Hypothèse: la dépense réelle atteint ${Math.round(REAL_SPEND_RATIO * 100)}% du budget engagé (Google lisse la diffusion). Budget engagé: ${budget.toLocaleString('fr-FR')} € par jour.`}
      >
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={budgetData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="campaign-budget-engage" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={ACCENT} stopOpacity={0.35} />
                <stop offset="100%" stopColor={ACCENT} stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="campaign-budget-reel" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={SECONDARY} stopOpacity={0.3} />
                <stop offset="100%" stopColor={SECONDARY} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={GRID_STROKE} vertical={false} />
            <XAxis dataKey="jour" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: GRID_STROKE }} interval={4} />
            <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={52} />
            <Tooltip content={<DarkTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.15)' }} />
            <Legend wrapperStyle={{ fontSize: 12, color: '#a1a1aa' }} iconType="circle" />
            <Area
              type="monotone"
              dataKey="engage"
              name="Budget engagé (€)"
              stroke={ACCENT}
              strokeWidth={2}
              fill="url(#campaign-budget-engage)"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
            />
            <Area
              type="monotone"
              dataKey="reel"
              name="Dépense réelle estimée (€)"
              stroke={SECONDARY}
              strokeWidth={2}
              fill="url(#campaign-budget-reel)"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </ChartBlock>

      <ChartBlock
        title="Répartition du budget quotidien par zone"
        note={splitRuleLabel(countries)}
      >
        <ResponsiveContainer width="100%" height={Math.max(140, zoneData.length * 48 + 60)}>
          <BarChart data={zoneData} layout="vertical" margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={GRID_STROKE} horizontal={false} />
            <XAxis type="number" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: GRID_STROKE }} />
            <YAxis type="category" dataKey="country" tick={AXIS_TICK} tickLine={false} axisLine={false} width={52} />
            <Tooltip content={<DarkTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
            <Legend wrapperStyle={{ fontSize: 12, color: '#a1a1aa' }} iconType="circle" />
            <Bar dataKey="budget" name="Budget / jour (€)" fill={ACCENT} radius={[0, 3, 3, 0]} maxBarSize={24} />
          </BarChart>
        </ResponsiveContainer>
      </ChartBlock>

      <ChartBlock
        title="Projection de clics et conversions sur 30 jours"
        note={`Hypothèses: CPC moyen ${CPC_EUR.toLocaleString('fr-FR')} €, taux de conversion ${(CVR * 100).toLocaleString('fr-FR')}%, sur la dépense réelle estimée (${Math.round(REAL_SPEND_RATIO * 100)}% du budget). Projections indicatives, pas une promesse de résultat.`}
      >
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={trafficData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={GRID_STROKE} vertical={false} />
            <XAxis dataKey="jour" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: GRID_STROKE }} interval={4} />
            <YAxis yAxisId="clics" tick={AXIS_TICK} tickLine={false} axisLine={false} width={52} />
            <YAxis
              yAxisId="conversions"
              orientation="right"
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={false}
              width={44}
            />
            <Tooltip content={<DarkTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.15)' }} />
            <Legend wrapperStyle={{ fontSize: 12, color: '#a1a1aa' }} iconType="circle" />
            <Line
              yAxisId="clics"
              type="monotone"
              dataKey="clics"
              name="Clics estimés"
              stroke={ACCENT}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
            />
            <Line
              yAxisId="conversions"
              type="monotone"
              dataKey="conversions"
              name="Conversions estimées"
              stroke={SECONDARY}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartBlock>
    </div>
  );
}

export default CampaignCharts;
