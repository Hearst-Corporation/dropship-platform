import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { resolveStoreId } from '@/lib/resolve-store';
import { enforceRateLimit } from '@/lib/rate-limit';
import { isGoogleAdsConfigured, pushGoogleAdsCampaign } from '@/lib/ads/google-ads';

export const dynamic = 'force-dynamic';

/**
 * POST /api/agent/stores/:id/campaign/push
 *
 * Deterministic path to push an existing `draft` campaign to Google Ads.
 *
 * Today the only trigger for a real push is the free-form super-agent chat,
 * and `dropship_ad_campaigns.status='draft'` rows are a dead end (no code
 * ever picks them back up). This route reprises such a draft:
 *
 *   1. Locates the draft to push (explicit `campaignId`, or the most recent
 *      draft on the `google` channel for the store).
 *   2. Rebuilds the `GoogleAdsPushArgs` from the persisted campaign + variant
 *      + store — the same mapping the super-agent's `execGoogleAdsPush` uses.
 *   3. Calls `pushGoogleAdsCampaign` (creates the campaign PAUSED on Google's
 *      side — zero auto-spend).
 *   4. Reconciles the draft row with the result so it is no longer a dead end:
 *      success -> status='paused' + external_id + pushed_at + push_response ;
 *      failure -> status='error' + error_message.
 *
 * Auth: the Basic Auth middleware already guards /api/agent/*, so no auth here.
 */

interface DraftCampaignRow {
  id: string;
  status: string;
  channel: string;
  variant_id: string | null;
  daily_budget_eur: string | number | null;
  push_payload: { days?: number } | null;
  headline: string | null;
  primary_text: string | null;
  description: string | null;
  cta: string | null;
}

/** Fallback horizon when the draft never stored one (helper defaults live in the plan). */
const DEFAULT_DAYS = 14;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const limited = await enforceRateLimit(req, 'campaign-push', { max: 10, windowSec: 60 });
  if (limited) return limited;

  const { id } = await params;
  const storeId = await resolveStoreId(id);
  if (!storeId) return NextResponse.json({ error: 'Store introuvable' }, { status: 404 });

  let campaignId: string | undefined;
  let channel = 'google';
  try {
    const raw = await req.text();
    if (raw) {
      const body = JSON.parse(raw) as { campaignId?: string; channel?: string };
      campaignId = body?.campaignId;
      if (body?.channel) channel = body.channel;
    }
  } catch {
    return NextResponse.json({ error: 'Corps JSON invalide' }, { status: 400 });
  }

  if (channel !== 'google') {
    return NextResponse.json(
      { error: `Canal '${channel}' non supporté par ce chemin (Google Ads uniquement).` },
      { status: 400 },
    );
  }

  if (!isGoogleAdsConfigured()) {
    return NextResponse.json(
      { error: 'Google Ads non configuré (developer token / OAuth manquants dans les env vars).' },
      { status: 400 },
    );
  }

  const db = getDb();

  // Store slug for the landing URL + campaign naming.
  const storeRes = await db.query<{ slug: string }>(
    `SELECT slug FROM dropship_stores WHERE id = $1 LIMIT 1`,
    [storeId],
  );
  const slug = storeRes.rows[0]?.slug;
  if (!slug) return NextResponse.json({ error: 'Store introuvable' }, { status: 404 });

  // Locate the draft: explicit id, else the most recent google draft for the store.
  const draftRes = campaignId
    ? await db.query<DraftCampaignRow>(
        `SELECT c.id, c.status, c.channel, c.variant_id, c.daily_budget_eur, c.push_payload,
                v.headline, v.primary_text, v.description, v.cta
           FROM dropship_ad_campaigns c
           LEFT JOIN dropship_ad_variants v ON v.id = c.variant_id
          WHERE c.id = $1 AND c.store_id = $2
          LIMIT 1`,
        [campaignId, storeId],
      )
    : await db.query<DraftCampaignRow>(
        `SELECT c.id, c.status, c.channel, c.variant_id, c.daily_budget_eur, c.push_payload,
                v.headline, v.primary_text, v.description, v.cta
           FROM dropship_ad_campaigns c
           LEFT JOIN dropship_ad_variants v ON v.id = c.variant_id
          WHERE c.store_id = $1 AND c.channel = 'google' AND c.status = 'draft'
          ORDER BY c.created_at DESC
          LIMIT 1`,
        [storeId],
      );

  const draft = draftRes.rows[0];
  if (!draft) {
    return NextResponse.json(
      { error: 'Aucune campagne draft Google Ads à pousser pour ce store.' },
      { status: 404 },
    );
  }
  if (!draft.variant_id || !draft.headline || !draft.primary_text) {
    return NextResponse.json(
      { error: 'Le draft est incomplet (variante ou textes d annonce manquants).' },
      { status: 400 },
    );
  }

  const dailyBudgetEur = Number(draft.daily_budget_eur);
  if (!Number.isFinite(dailyBudgetEur) || dailyBudgetEur <= 0) {
    return NextResponse.json(
      { error: 'Budget quotidien invalide sur le draft.' },
      { status: 400 },
    );
  }
  const days =
    draft.push_payload?.days && draft.push_payload.days > 0 ? draft.push_payload.days : DEFAULT_DAYS;

  // Same landing URL convention as the super-agent's execGoogleAdsPush.
  const productUrl = `https://${slug}.hearstcorporation.io/`;

  // pushGoogleAdsCampaign creates the campaign PAUSED and persists its own
  // audit row; it never throws (fail-soft), returning status 'paused' | 'error'.
  const result = await pushGoogleAdsCampaign({
    storeId,
    storeSlug: slug,
    variantId: draft.variant_id,
    headline: draft.headline,
    primaryText: draft.primary_text,
    description: draft.description ?? null,
    cta: draft.cta ?? null,
    imageUrl: null,
    productUrl,
    dailyBudgetEur,
    days,
  });

  if (result.status === 'paused') {
    // Reconcile the ORIGINAL draft row so it is no longer a dead end.
    await db.query(
      `UPDATE dropship_ad_campaigns
          SET status = 'paused',
              external_id = $2,
              pushed_at = now(),
              error_message = NULL,
              push_response = $3
        WHERE id = $1`,
      [
        draft.id,
        result.externalId,
        JSON.stringify({ pushedVia: 'admin', campaignDbId: result.campaignDbId }),
      ],
    );
    return NextResponse.json({
      success: true,
      externalId: result.externalId,
      status: 'paused',
      message:
        'Campagne créée en PAUSE sur Google Ads (aucune dépense automatique). Active-la dans l interface Google Ads après vérification.',
    });
  }

  // Failure: pushGoogleAdsCampaign returned status='error' (or unexpected).
  const message = result.error ?? 'Échec du push Google Ads.';
  await db.query(
    `UPDATE dropship_ad_campaigns
        SET status = 'error', error_message = $2
      WHERE id = $1`,
    [draft.id, message],
  );
  return NextResponse.json({ success: false, error: message }, { status: 502 });
}
