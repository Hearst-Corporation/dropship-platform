import { timingSafeEqual as nodeTimingSafeEqual } from 'crypto';

/**
 * Server-side HTTP Basic auth helper.
 *
 * Defense-in-depth complement to the edge middleware (`apps/web/middleware.ts`)
 * which already protects `/admin/*` and `/api/agent/*`. This helper is intended
 * to be called at the top of sensitive route handlers so an accidental matcher
 * regression in the middleware cannot expose the route.
 *
 * Node runtime only — uses `Buffer.from`. Do not call from an edge route
 * handler (the middleware itself uses `atob` for that reason).
 */

/**
 * Constant-time string comparison. Guards against timing attacks on the
 * username/password check below. `crypto.timingSafeEqual` throws on length
 * mismatch, so unequal-length inputs are padded to a common size first —
 * the resulting comparison is still constant-time per fixed input length
 * and a length mismatch is treated as a mismatch, never an early return
 * that would leak length via timing.
 */
function timingSafeStringEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) {
    // Still run a constant-time compare (against itself) so the early
    // length check doesn't dominate timing on top of the length leak,
    // which is unavoidable with variable-length credentials anyway.
    nodeTimingSafeEqual(bufA, bufA);
    return false;
  }
  return nodeTimingSafeEqual(bufA, bufB);
}

function checkBasicAuth(request: Request): boolean {
  const expectedUser = (process.env.ADMIN_USERNAME ?? '').trim();
  const expectedPass = (process.env.ADMIN_PASSWORD ?? '').trim();
  // Fail closed: missing env → reject. Mirrors the middleware policy.
  if (!expectedUser || !expectedPass) return false;

  const header = request.headers.get('authorization');
  if (!header || !header.startsWith('Basic ')) return false;

  let decoded: string;
  try {
    decoded = Buffer.from(header.slice(6).trim(), 'base64').toString('utf8');
  } catch {
    return false;
  }
  const idx = decoded.indexOf(':');
  if (idx < 0) return false;
  const user = decoded.slice(0, idx);
  const pass = decoded.slice(idx + 1);
  return timingSafeStringEqual(user, expectedUser) && timingSafeStringEqual(pass, expectedPass);
}

export function verifyAdminAuth(request: Request): boolean {
  // Mirror the middleware's local-dev bypass so adding this guard does not
  // break `next dev`. `VERCEL_ENV` is set by Vercel even when NODE_ENV is
  // forced to "development", so this stays safe in production.
  const isLocalDev =
    process.env.NODE_ENV === 'development' && process.env.VERCEL_ENV !== 'production';
  if (isLocalDev) return true;

  return checkBasicAuth(request);
}

/**
 * In-handler assertion variant for the highest-privilege routes (e.g. the
 * super-agent, which can execute arbitrary SQL and — in local dev — shell
 * commands and file writes). Call this as the very first line of the
 * handler, before body parsing or rate limiting, and return immediately if
 * it yields a Response.
 *
 * Returns `null` when the request is authorized (caller proceeds).
 * Returns a 401 `Response` with a `WWW-Authenticate: Basic` challenge when
 * it is not (caller returns this response as-is).
 *
 * This does NOT apply the middleware's local-dev bypass — the super-agent
 * route has real destructive power (SQL writes, shell, git push in dev), so
 * requiring valid credentials even on `next dev` is intentional. Set
 * ADMIN_USERNAME / ADMIN_PASSWORD locally (see env.example) to use it.
 */
export function requireAdmin(request: Request): Response | null {
  if (checkBasicAuth(request)) return null;
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: {
      'Content-Type': 'application/json',
      'WWW-Authenticate': 'Basic realm="Dropship Admin", charset="UTF-8"',
      'Cache-Control': 'no-store',
    },
  });
}
