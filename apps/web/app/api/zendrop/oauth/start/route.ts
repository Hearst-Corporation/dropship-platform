/**
 * GET /api/zendrop/oauth/start
 *
 * Initiates the Zendrop OAuth2 Authorization Code + PKCE flow.
 * Redirects the browser to the Zendrop authorization page.
 *
 * Required env vars:
 *   SUPPLIER_ZENDROP_CLIENT_ID     — OAuth client id
 *   SUPPLIER_ZENDROP_CLIENT_SECRET — OAuth client secret (used in callback)
 *   SUPPLIER_ZENDROP_MCP_URL       — (optional) MCP endpoint override
 *
 * // CONFIRM: ZENDROP_AUTHORIZE_URL against Zendrop OAuth docs.
 * Currently set to https://app.zendrop.com/oauth/authorize.
 */
import { NextResponse } from 'next/server';
import { randomBytes, createHash } from 'crypto';
import { ZENDROP_AUTHORIZE_URL } from '@/lib/suppliers/zendrop';

const CLIENT_ID = (process.env.SUPPLIER_ZENDROP_CLIENT_ID || '').trim();

/** The callback URL must be registered in the Zendrop app console. */
function callbackUrl(): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:4302');
  return `${base}/api/zendrop/oauth/callback`;
}

/** PKCE: base64url-encode a Buffer without padding. */
function base64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

export async function GET() {
  if (!CLIENT_ID) {
    return NextResponse.json(
      { error: 'SUPPLIER_ZENDROP_CLIENT_ID not configured' },
      { status: 500 },
    );
  }

  // PKCE code verifier: 32 random bytes → base64url (43-128 chars, spec §4.1)
  const codeVerifier = base64url(randomBytes(32));

  // Code challenge: S256 method — BASE64URL(SHA256(ASCII(codeVerifier)))
  const codeChallenge = base64url(
    Buffer.from(createHash('sha256').update(codeVerifier, 'ascii').digest()),
  );

  // Anti-CSRF state token
  const state = randomBytes(16).toString('hex');

  const redirectUri = callbackUrl();

  // // CONFIRM: Zendrop supports 'code' response_type and PKCE params.
  const authUrl = new URL(ZENDROP_AUTHORIZE_URL);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('scope', 'catalog:read orders:write orders:read');
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('code_challenge', codeChallenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');

  const res = NextResponse.redirect(authUrl.toString());

  const secure = process.env.NODE_ENV === 'production';

  // Store verifier + state in short-lived HttpOnly cookies (10 min).
  res.cookies.set('zendrop_oauth_state', state, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  });
  res.cookies.set('zendrop_pkce_verifier', codeVerifier, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  });

  return res;
}
