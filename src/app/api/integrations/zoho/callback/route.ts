// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/integrations/zoho/callback
//
// Zoho Books OAuth 2.0 callback. Zoho redirects here with `?code=...&state=...`
// after the user consents. This route:
//   1. Decodes the OAuth state (orgId, userId, returnPath, redirectUri)
//   2. Exchanges the authorization code for access + refresh tokens
//   3. Persists the AES-256-GCM-encrypted tokens to the ZohoBooksToken table
//   4. (Best-effort) fetches + stores the user's default Zoho Books org
//   5. Writes a safeAudit entry (ZOHO_BOOKS_CONNECT)
//   6. Redirects the browser to the ROOT route with ?zoho_connected=1&view=zoho-books
//
// STAGE-BY-STAGE DIAGNOSTIC LOGGING (requirement #12):
//   Each stage logs a `[zoho/callback] STAGE N: ...` line to the server log.
//   On failure, the log includes the stage name + the underlying error (NO
//   secrets — never logs access_token / refresh_token / client_secret).
//   The redirect URL includes `zoho_stage` so the UI can show WHICH stage
//   failed (helpful for debugging without exposing credentials).
//
// On any failure, redirects with ?zoho_error=<message>&zoho_stage=<stage>.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import {
  exchangeCodeForTokens,
  storeTokens,
  decodeState,
  resolveRedirectUri,
} from '@/lib/integrations/zoho-books';
import { safeAudit } from '@/lib/audit/safe-write';

function originFromRedirectUri(redirectUri: string | undefined, req: Request): string {
  if (redirectUri) {
    try {
      const parsed = new URL(redirectUri);
      return `${parsed.protocol}//${parsed.host}`;
    } catch {
      /* ignore */
    }
  }
  try {
    const u = new URL(req.url);
    return `${u.protocol}//${u.host}`;
  } catch {
    return 'http://localhost:3000';
  }
}

function buildAppRedirectUrl(
  publicOrigin: string,
  returnPath: string,
  params: Record<string, string>,
): string {
  const viewName =
    returnPath.replace(/^\/+/, '').replace(/[?].*$/, '') || 'zoho-books';
  const url = new URL('/', publicOrigin);
  url.searchParams.set('view', viewName);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return url.toString();
}

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  const stage = 'callback';
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state') ?? '';
  const zohoError = url.searchParams.get('error');

  // ─── STAGE 0: Decode state ───
  const decoded = decodeState(state);
  const returnPath = decoded?.returnPath ?? '/zoho-books';
  const publicOrigin = originFromRedirectUri(decoded?.redirectUri, req);

  // Zoho-side error (user denied consent, redirect_uri mismatch, etc.)
  if (zohoError) {
    const errorDesc = url.searchParams.get('error_description') ?? zohoError;
    console.warn(`[zoho/${stage}] STAGE 0 FAIL: Zoho returned error="${zohoError}" desc="${errorDesc}"`);
    const target = buildAppRedirectUrl(publicOrigin, returnPath, {
      zoho_error: errorDesc,
      zoho_stage: 'authorization',
    });
    return NextResponse.redirect(new URL(target));
  }

  if (!code || !decoded) {
    console.warn(`[zoho/${stage}] STAGE 0 FAIL: missing code or invalid state (code=${code ? 'present' : 'missing'}, state=${state ? 'present' : 'missing'})`);
    const target = buildAppRedirectUrl(publicOrigin, returnPath, {
      zoho_error: 'Missing authorization code or invalid OAuth state. Please try connecting again.',
      zoho_stage: 'state',
    });
    return NextResponse.redirect(new URL(target));
  }

  console.info(`[zoho/${stage}] STAGE 0 OK: state decoded (org=${decoded.orgId}, user=${decoded.userId}, returnPath=${returnPath})`);

  // ─── STAGE 1: Token exchange ───
  const redirectUri = decoded.redirectUri ?? resolveRedirectUri(req);
  console.info(`[zoho/${stage}] STAGE 1: exchanging code for tokens (redirectUri=${redirectUri})`);

  const { tokens, userInfo, error: exchangeError } = await exchangeCodeForTokens(code, redirectUri);
  if (exchangeError || !tokens.accessToken) {
    console.error(`[zoho/${stage}] STAGE 1 FAIL: token exchange failed — ${exchangeError ?? 'no access_token'}`);
    const target = buildAppRedirectUrl(publicOrigin, returnPath, {
      zoho_error: exchangeError ?? 'Zoho did not return an access token. Please reconnect.',
      zoho_stage: 'token_exchange',
    });
    return NextResponse.redirect(new URL(target));
  }
  console.info(`[zoho/${stage}] STAGE 1 OK: tokens received (scope=${tokens.scope?.slice(0, 60) ?? 'none'}..., expires=${tokens.expiryDate?.toISOString() ?? 'unknown'})`);

  // ─── STAGE 2: Token storage ───
  let stored;
  try {
    stored = await storeTokens(
      decoded.orgId,
      decoded.userId,
      decoded.userEmail || userInfo.email || 'unknown@zoho',
      userInfo.userId ?? null,
      tokens,
    );
    console.info(`[zoho/${stage}] STAGE 2 OK: tokens encrypted + stored (tokenRowId=${stored.id}, orgMapping=${stored.zohoOrgId ?? 'pending'})`);
  } catch (storeErr) {
    console.error(`[zoho/${stage}] STAGE 2 FAIL: token storage failed —`, storeErr);
    const target = buildAppRedirectUrl(publicOrigin, returnPath, {
      zoho_error: storeErr instanceof Error ? `Token storage failed: ${storeErr.message}` : 'Failed to store Zoho tokens securely.',
      zoho_stage: 'token_storage',
    });
    return NextResponse.redirect(new URL(target));
  }

  // ─── STAGE 3: Audit log (best-effort) ───
  try {
    await safeAudit({
      userId: decoded.userId,
      action: 'ZOHO_BOOKS_CONNECT',
      entity: 'ZohoBooksToken',
      entityId: stored.id,
      newValue: JSON.stringify({
        userEmail: stored.userEmail,
        zohoUserId: stored.zohoUserId,
        zohoOrgId: stored.zohoOrgId,
        zohoOrgName: stored.zohoOrgName,
        dataCenter: stored.dataCenter,
      }),
      details: `Connected Zoho Books as ${stored.userEmail}`,
    });
    console.info(`[zoho/${stage}] STAGE 3 OK: audit logged`);
  } catch (auditErr) {
    console.warn(`[zoho/${stage}] STAGE 3 WARN: audit log failed (non-fatal) —`, auditErr);
  }

  // ─── SUCCESS ───
  console.info(`[zoho/${stage}] SUCCESS: user=${stored.userEmail} org=${stored.zohoOrgName ?? 'none'} (${stored.zohoOrgId ?? 'none'})`);
  const target = buildAppRedirectUrl(publicOrigin, returnPath, {
    zoho_connected: '1',
  });
  return NextResponse.redirect(new URL(target));
}
