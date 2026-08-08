// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/integrations/zoho/diagnostics
//
// Safe development diagnostic endpoint. Returns the CURRENT OAuth configuration
// (NO secrets) so developers can verify the setup matches the Zoho API Console.
//
// Returns:
//   {
//     ok: true,
//     configured: boolean,              // are CLIENT_ID + CLIENT_SECRET set?
//     dataCenter: "in"|"com"|...,
//     accountsUrl: string,              // e.g. https://accounts.zoho.in
//     apiBaseUrl: string,               // e.g. https://www.zohoapis.in/books/v3
//     redirectUri: string,              // the EXACT redirect_uri GSTPilot will use
//     redirectUriSource: "env"|"dynamic",
//     clientIdPrefix: string,           // first 20 chars only — NEVER the full secret
//     scope: string,
//     envVars: { ... booleans ... }     // which ZOHO_* vars are set
//   }
//
// SECURITY: This endpoint NEVER returns client_secret, access tokens, refresh
// tokens, or any encrypted credential material. It only returns enough info to
// debug OAuth configuration mismatches.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import {
  getZohoEndpoints,
  resolveRedirectUri,
  ZOHO_BOOKS_SCOPE,
  resolveOrgUserFromHeaders,
} from '@/lib/integrations/zoho-books';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  const { orgId, userId } = resolveOrgUserFromHeaders(req);

  const clientId = process.env.ZOHO_CLIENT_ID;
  const clientSecret = process.env.ZOHO_CLIENT_SECRET;
  const envRedirectUri = process.env.ZOHO_REDIRECT_URI;
  const forceDynamic = process.env.ZOHO_REDIRECT_URI_DYNAMIC === 'true';

  const endpoints = (() => {
    try {
      return getZohoEndpoints();
    } catch {
      return null;
    }
  })();

  const effectiveRedirectUri = (() => {
    try {
      return resolveRedirectUri(req);
    } catch {
      return envRedirectUri ?? '(unable to resolve)';
    }
  })();

  const redirectUriSource = envRedirectUri && !forceDynamic ? 'env' : 'dynamic';

  return NextResponse.json({
    ok: true,
    timestamp: new Date().toISOString(),
    authContext: {
      hasOrgId: Boolean(orgId),
      hasUserId: Boolean(userId),
    },
    configured: Boolean(clientId && clientSecret),
    dataCenter: endpoints?.dc ?? process.env.ZOHO_DC ?? 'in',
    accountsUrl: endpoints?.authBaseUrl?.replace('/oauth/v2/auth', '') ?? null,
    apiBaseUrl: endpoints?.apiBaseUrl ?? null,
    redirectUri: effectiveRedirectUri,
    redirectUriSource,
    clientIdPrefix: clientId
      ? clientId.slice(0, 20) + (clientId.length > 20 ? '…' : '')
      : null,
    scope: ZOHO_BOOKS_SCOPE,
    envVars: {
      ZOHO_CLIENT_ID: Boolean(clientId),
      ZOHO_CLIENT_SECRET: Boolean(clientSecret),
      ZOHO_REDIRECT_URI: Boolean(envRedirectUri),
      ZOHO_DC: Boolean(process.env.ZOHO_DC),
      ZOHO_REDIRECT_URI_DYNAMIC: forceDynamic,
      ZOHO_ACCOUNTS_URL: Boolean(process.env.ZOHO_ACCOUNTS_URL),
      ZOHO_BOOKS_API: Boolean(process.env.ZOHO_BOOKS_API),
    },
    zohoConsoleRequirements: {
      redirectUriMustMatch: effectiveRedirectUri,
      note:
        'The redirect URI above MUST be registered exactly (protocol + host + port + path) in the Zoho API Console → your Client → Authorized Redirect URIs.',
    },
  });
}
