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
//      so the dashboard shell renders the Zoho Books page (matching the Google
//      Workspace callback pattern).
//
// On any failure, redirects with ?zoho_error=<message>.
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
  // Normalize the return path into a view name for the dashboard shell.
  // e.g. "/zoho-books" → "zoho-books", "/google-workspace" → "google-workspace".
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
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state') ?? '';
  const zohoError = url.searchParams.get('error');

  const decoded = decodeState(state);
  const returnPath = decoded?.returnPath ?? '/zoho-books';

  const publicOrigin = originFromRedirectUri(decoded?.redirectUri, req);

  // Zoho-side error (user denied consent, etc.)
  if (zohoError) {
    const target = buildAppRedirectUrl(publicOrigin, returnPath, {
      zoho_error: zohoError,
    });
    return NextResponse.redirect(new URL(target));
  }

  if (!code || !decoded) {
    const target = buildAppRedirectUrl(publicOrigin, returnPath, {
      zoho_error: 'Missing code or invalid state.',
    });
    return NextResponse.redirect(new URL(target));
  }

  try {
    const redirectUri = decoded.redirectUri ?? resolveRedirectUri(req);

    const { tokens, userInfo, error } = await exchangeCodeForTokens(code, redirectUri);
    if (error || !tokens.accessToken) {
      const target = buildAppRedirectUrl(publicOrigin, returnPath, {
        zoho_error: error ?? 'No access token returned.',
      });
      return NextResponse.redirect(new URL(target));
    }

    const stored = await storeTokens(
      decoded.orgId,
      decoded.userId,
      decoded.userEmail || userInfo.email || 'unknown@zoho',
      userInfo.userId ?? null,
      tokens,
    );

    // Production-grade audit logging (best-effort — never throws).
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
    } catch (auditErr) {
      console.warn('[/api/integrations/zoho/callback] audit log failed:', auditErr);
    }

    const target = buildAppRedirectUrl(publicOrigin, returnPath, {
      zoho_connected: '1',
    });
    return NextResponse.redirect(new URL(target));
  } catch (err) {
    console.error('[/api/integrations/zoho/callback] error:', err);
    const target = buildAppRedirectUrl(publicOrigin, returnPath, {
      zoho_error: err instanceof Error ? err.message : 'Callback failed.',
    });
    return NextResponse.redirect(new URL(target));
  }
}
