/**
 * GET /api/zendrop/oauth/callback
 *
 * Zendrop OAuth2 callback: exchanges the authorization code for tokens,
 * encrypts them, and stores them in platform_settings.
 *
 * Required env vars:
 *   SUPPLIER_ZENDROP_CLIENT_ID
 *   SUPPLIER_ZENDROP_CLIENT_SECRET
 *
 * // CONFIRM: ZENDROP_TOKEN_URL against Zendrop OAuth docs.
 * Currently set to https://app.zendrop.com/oauth/token.
 */
import { NextRequest, NextResponse } from 'next/server';
import { ZENDROP_TOKEN_URL, saveZendropTokens } from '@/lib/suppliers/zendrop';

const CLIENT_ID = (process.env.SUPPLIER_ZENDROP_CLIENT_ID || '').trim();
const CLIENT_SECRET = (process.env.SUPPLIER_ZENDROP_CLIENT_SECRET || '').trim();

function callbackUrl(): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:4302');
  return `${base}/api/zendrop/oauth/callback`;
}

function clearOAuthCookies(res: NextResponse): void {
  const opts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: 0,
    path: '/',
  };
  res.cookies.set('zendrop_oauth_state', '', opts);
  res.cookies.set('zendrop_pkce_verifier', '', opts);
}

function errorPage(message: string): NextResponse {
  const safe = message.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]!));
  const res = new NextResponse(
    `<html><body style="font-family:sans-serif;padding:2rem;max-width:600px;margin:0 auto">
      <h2>Zendrop OAuth Error</h2>
      <p>${safe}</p>
      <a href="/admin/settings" style="display:inline-block;margin-top:1rem;padding:.5rem 1rem;background:#000;color:#fff;border-radius:8px;text-decoration:none">← Retour admin</a>
    </body></html>`,
    { headers: { 'Content-Type': 'text/html' }, status: 500 },
  );
  clearOAuthCookies(res);
  return res;
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const errorParam = searchParams.get('error');

  // Surface upstream denial (user declined, misconfigured app, etc.)
  if (errorParam) {
    console.error('[zendrop-oauth] upstream error', errorParam, searchParams.get('error_description'));
    return errorPage('Zendrop a refusé la connexion. Vérifie les logs serveur.');
  }

  if (!code) {
    return NextResponse.json({ error: 'Missing code parameter' }, { status: 400 });
  }

  const cookieState = req.cookies.get('zendrop_oauth_state')?.value;
  const codeVerifier = req.cookies.get('zendrop_pkce_verifier')?.value;

  if (!state || !cookieState || state !== cookieState) {
    return NextResponse.json(
      { error: 'Invalid or missing state — possible CSRF attack.' },
      { status: 403 },
    );
  }

  if (!codeVerifier) {
    return NextResponse.json({ error: 'Missing PKCE verifier cookie' }, { status: 400 });
  }

  if (!CLIENT_ID || !CLIENT_SECRET) {
    return errorPage('SUPPLIER_ZENDROP_CLIENT_ID or SUPPLIER_ZENDROP_CLIENT_SECRET not configured.');
  }

  // Exchange authorization code for tokens.
  // // CONFIRM: Zendrop token endpoint accepts application/x-www-form-urlencoded
  // with grant_type=authorization_code + code_verifier (PKCE).
  const tokenRes = await fetch(ZENDROP_TOKEN_URL, {
    method: 'POST',
    signal: AbortSignal.timeout(15_000),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: callbackUrl(),
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code_verifier: codeVerifier,
    }).toString(),
  });

  const rawBody = await tokenRes.text();
  let data: {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    token_type?: string;
    error?: string;
    error_description?: string;
  } = {};
  try {
    data = JSON.parse(rawBody);
  } catch {
    // keep empty — fall through to error branch below
  }

  if (!data.access_token || data.error) {
    console.error('[zendrop-oauth] token exchange failed', {
      httpStatus: tokenRes.status,
      body: rawBody,
    });
    return errorPage('Échec de la connexion Zendrop. Vérifie les logs serveur ou réessaie.');
  }

  const expiresAt = Date.now() + (data.expires_in ?? 3600) * 1000;

  await saveZendropTokens({
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt,
  });

  const successRes = new NextResponse(
    `<html><body style="font-family:sans-serif;padding:2rem;max-width:600px;margin:0 auto">
      <h2>Zendrop connecté !</h2>
      <p>Le token d'accès a été sauvegardé. L'agent peut maintenant utiliser Zendrop.</p>
      <a href="/admin/settings" style="display:inline-block;margin-top:1rem;padding:.5rem 1rem;background:#000;color:#fff;border-radius:8px;text-decoration:none">← Retour admin</a>
    </body></html>`,
    { headers: { 'Content-Type': 'text/html' } },
  );
  clearOAuthCookies(successRes);
  return successRes;
}
