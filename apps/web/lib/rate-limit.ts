import { getDb } from '@/lib/db';
import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';

/**
 * Rate limiter with an Upstash Redis backend and a Postgres fallback.
 *
 * Usage:
 *   const r = await checkRateLimit(`create-store:${ip}`, { max: 5, windowSec: 60 });
 *   if (!r.ok) return new Response('rate limited', { status: 429 });
 *
 * Behaviour:
 * - When UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN are set, counters
 *   live in Upstash Redis via a sliding-window limiter. This is shared across
 *   every serverless instance, so `max` is an actual global cap instead of a
 *   per-Lambda-cold-start approximation.
 * - One `Ratelimit` instance is cached per (max, windowSec) pair so we reuse
 *   the same sliding-window algorithm instance across calls in a warm Lambda.
 * - When Upstash env vars are absent (e.g. local dev without Redis configured),
 *   this transparently falls back to the previous Postgres-backed sliding
 *   bucket implementation — same semantics, same table. A single warning is
 *   logged the first time the fallback kicks in, not on every request.
 * - Fails OPEN in both backends: a transient Upstash or Postgres error lets
 *   the request through rather than blocking real traffic.
 */

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSec: number;
}

// --- Upstash backend -------------------------------------------------------

let redisClient: Redis | null | undefined; // undefined = not yet resolved
let fallbackWarned = false;

function warnFallbackOnce(reason: string) {
  if (fallbackWarned) return;
  fallbackWarned = true;
  console.warn(
    `[rate-limit] Upstash Redis not available (${reason}) — falling back to the in-DB Postgres rate limiter. ` +
      'Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN to enable the shared Redis-backed limiter.',
  );
}

function getRedisClient(): Redis | null {
  if (redisClient !== undefined) return redisClient;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    warnFallbackOnce('UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN not set');
    redisClient = null;
    return redisClient;
  }

  try {
    redisClient = new Redis({ url, token });
  } catch (err) {
    warnFallbackOnce(err instanceof Error ? err.message : 'failed to init Upstash client');
    redisClient = null;
  }
  return redisClient;
}

// One Ratelimit instance per (max, windowSec) pair — the sliding-window
// algorithm is stateless config-wise, so it's safe (and cheap) to reuse.
const limiterCache = new Map<string, Ratelimit>();

function getLimiter(redis: Redis, max: number, windowSec: number): Ratelimit {
  const cacheKey = `${max}:${windowSec}`;
  let limiter = limiterCache.get(cacheKey);
  if (!limiter) {
    limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(max, `${windowSec} s`),
      // Keep the same bucket-key convention as the Postgres fallback so the
      // two backends namespace identically if a deploy flips between them.
      prefix: 'dropship_rl',
      analytics: false,
    });
    limiterCache.set(cacheKey, limiter);
  }
  return limiter;
}

async function checkRateLimitRedis(
  redis: Redis,
  key: string,
  opts: { max: number; windowSec?: number },
): Promise<RateLimitResult> {
  const windowSec = opts.windowSec ?? 60;
  const limiter = getLimiter(redis, opts.max, windowSec);
  const { success, remaining, reset } = await limiter.limit(key);
  const retryAfterSec = Math.max(0, Math.ceil((reset - Date.now()) / 1000));
  return { ok: success, remaining: Math.max(0, remaining), retryAfterSec };
}

// --- Postgres fallback (previous implementation, unchanged semantics) ------

/**
 * Tiny Postgres-backed sliding-bucket rate limiter. Used automatically when
 * Upstash Redis isn't configured.
 *
 * - One bucket per `floor(now / windowSec)`. Atomic UPSERT bumps the counter so
 *   concurrent requests can't race past the limit.
 * - The atomic check uses a single CTE: INSERT ... ON CONFLICT DO UPDATE, then
 *   SELECT count in the same statement. This guarantees that two concurrent
 *   requests see each other's increments — no race condition.
 * - Once we cross `max`, subsequent calls in the same bucket return ok=false
 *   without further DB writes (the SQL still runs, but it's still a single
 *   round-trip).
 * - Old buckets are trimmed opportunistically (~1 sweep per 100 calls). This is
 *   cheap because of `idx_rate_limits_bucket` and keeps the table tiny.
 */
async function checkRateLimitPostgres(
  key: string,
  opts: { max: number; windowSec?: number },
): Promise<RateLimitResult> {
  const windowSec = opts.windowSec ?? 60;
  const nowSec = Math.floor(Date.now() / 1000);
  const bucket = Math.floor(nowSec / windowSec);
  const db = getDb();

  // Atomic CTE: upsert then read the final count in one round-trip.
  // The RETURNING from the UPSERT gives us the post-increment count;
  // concurrent requests are serialized by the row lock.
  const { rows } = await db.query<{ count: number }>(
    `WITH upsert AS (
       INSERT INTO dropship_rate_limits (key, bucket, count) VALUES ($1, $2, 1)
       ON CONFLICT (key, bucket)
       DO UPDATE SET count = dropship_rate_limits.count + 1
       RETURNING count
     )
     SELECT count FROM upsert`,
    [key, bucket],
  );
  const count = rows[0]?.count ?? 1;

  // Cheap probabilistic GC of expired buckets.
  if (Math.random() < 0.01) {
    db.query(`DELETE FROM dropship_rate_limits WHERE bucket < $1`, [bucket - 5]).catch(() => {});
  }

  const remaining = Math.max(0, opts.max - count);
  const retryAfterSec = (bucket + 1) * windowSec - nowSec;
  return { ok: count <= opts.max, remaining, retryAfterSec };
}

// --- Public API (unchanged signatures) --------------------------------------

export async function checkRateLimit(
  key: string,
  opts: { max: number; windowSec?: number },
): Promise<RateLimitResult> {
  const redis = getRedisClient();
  if (redis) {
    try {
      return await checkRateLimitRedis(redis, key, opts);
    } catch (err) {
      warnFallbackOnce(err instanceof Error ? err.message : 'Upstash request failed');
      return checkRateLimitPostgres(key, opts);
    }
  }
  return checkRateLimitPostgres(key, opts);
}

/** Best-effort client IP extraction. Vercel sets x-forwarded-for. */
export function clientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) {
    const ip = xff.split(',')[0]?.trim();
    if (ip) return ip.substring(0, 45); // cap at IPv6 max length
  }
  return req.headers.get('x-real-ip')?.trim() || 'unknown';
}

/**
 * Per-IP rate-limit guard for public route handlers. Returns a 429 Response
 * when over the limit, or null when the request should proceed.
 *
 * Fails OPEN: if the underlying rate-limit backend errors, real users still go
 * through. The cost of a missed 429 in a transient blip is far lower than the
 * cost of blocking paid traffic during the same blip.
 *
 * Usage:
 *   const limited = await enforceRateLimit(request, 'cart-add', { max: 30 });
 *   if (limited) return limited;
 */
export async function enforceRateLimit(
  req: Request,
  scope: string,
  opts: { max: number; windowSec?: number },
): Promise<Response | null> {
  try {
    const ip = clientIp(req);
    const r = await checkRateLimit(`${scope}:${ip}`, opts);
    if (r.ok) return null;
    return new Response(
      JSON.stringify({ success: false, error: 'Trop de requêtes, réessayez dans un instant.' }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(r.retryAfterSec),
        },
      },
    );
  } catch {
    return null;
  }
}
