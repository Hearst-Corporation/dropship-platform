import 'server-only';
import { getDbRead } from '@/lib/db';

/**
 * Reads ALL real ad campaigns across every store from dropship_ad_campaigns,
 * with performance derived from dropship_funnel_events. No mock data — empty
 * array when nothing has been pushed yet.
 */
export interface AdCampaignRow {
  id: string;
  channel: string;
  status: string;
  storeName: string | null;
  storeSlug: string | null;
  hook: string | null;
  dailyBudgetEur: number | null;
  spentEur: number;
  revenueEur: number;
  views: number;
  conversions: number;
  pushedAt: string | null;
}

export type AdChannel = 'google' | 'meta' | 'tiktok' | 'amazon';

export interface ChannelConnection {
  channel: AdChannel;
  connected: boolean;
}

interface QueryRow {
  id: string;
  channel: string;
  status: string;
  store_name: string | null;
  store_slug: string | null;
  hook: string | null;
  daily_budget_eur: string | number | null;
  pushed_at: string | null;
  views: string | number;
  purchases: string | number;
  revenue_cents: string | number;
}

export async function getAllCampaigns(): Promise<AdCampaignRow[]> {
  const db = getDbRead();
  const { rows } = await db.query<QueryRow>(
    `SELECT
        c.id,
        c.channel,
        c.status,
        s.name AS store_name,
        s.slug AS store_slug,
        v.headline AS hook,
        c.daily_budget_eur,
        c.pushed_at,
        COUNT(f.id) FILTER (WHERE f.event_name = 'view_content') AS views,
        COUNT(f.id) FILTER (WHERE f.event_name = 'purchase') AS purchases,
        COALESCE(SUM(f.value_minor) FILTER (WHERE f.event_name = 'purchase'), 0)::bigint AS revenue_cents
     FROM dropship_ad_campaigns c
     LEFT JOIN dropship_stores s ON s.id = c.store_id
     LEFT JOIN dropship_ad_variants v ON v.id = c.variant_id
     LEFT JOIN dropship_funnel_events f
            ON f.utm_campaign = 'dsv-' || s.slug || '-' || c.variant_id::text
           AND f.created_at > c.created_at
     GROUP BY c.id, c.channel, c.status, s.name, s.slug, v.headline,
              c.daily_budget_eur, c.pushed_at, c.created_at
     ORDER BY revenue_cents DESC, c.created_at DESC`,
  );

  return rows.map((r) => {
    const dailyBudgetEur = r.daily_budget_eur != null ? Number(r.daily_budget_eur) : null;
    let spentEur = 0;
    if (dailyBudgetEur && r.pushed_at) {
      const daysLive = Math.max(
        1,
        Math.ceil((Date.now() - new Date(r.pushed_at).getTime()) / 86_400_000),
      );
      spentEur = dailyBudgetEur * daysLive;
    }
    return {
      id: r.id,
      channel: r.channel,
      status: r.status,
      storeName: r.store_name,
      storeSlug: r.store_slug,
      hook: r.hook,
      dailyBudgetEur,
      spentEur,
      revenueEur: Number(r.revenue_cents) / 100,
      views: Number(r.views) || 0,
      conversions: Number(r.purchases) || 0,
      pushedAt: r.pushed_at,
    };
  });
}

/** Real provider connection state, read from env vars. No mock. */
export function getChannelConnections(): ChannelConnection[] {
  return [
    {
      channel: 'google',
      connected: Boolean(
        process.env.GOOGLE_ADS_DEVELOPER_TOKEN &&
          process.env.GOOGLE_ADS_CLIENT_ID &&
          process.env.GOOGLE_ADS_CUSTOMER_ID,
      ),
    },
    {
      channel: 'meta',
      connected: Boolean(process.env.META_ADS_ACCESS_TOKEN && process.env.META_ADS_AD_ACCOUNT_ID),
    },
    {
      channel: 'tiktok',
      connected: Boolean(process.env.TIKTOK_ADS_ACCESS_TOKEN && process.env.TIKTOK_ADS_ADVERTISER_ID),
    },
    {
      channel: 'amazon',
      connected: Boolean(process.env.AMAZON_ADS_REFRESH_TOKEN && process.env.AMAZON_ADS_PROFILE_ID),
    },
  ];
}
