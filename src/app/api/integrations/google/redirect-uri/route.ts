// ═══════════════════════════════════════════════════════════════════════════════
// /api/integrations/google/redirect-uri — Debug endpoint
//
// GET /api/integrations/google/redirect-uri
//   Returns the OAuth redirect URI that the connect/callback routes will
//   derive from the current request's forwarded headers, plus the raw
//   header values for transparency. Use this to verify exactly which URI
//   must be registered in Google Cloud Console → Credentials → OAuth 2.0
//   Client → "Authorized redirect URIs" for the current access path.
//
// Response: {
//   ok: true,
//   redirectUri: string,             // the URI sent to Google (= what to register)
//   origin: string,                  // the resolved public origin
//   host: string | null,             // Host header
//   forwardedHost: string | null,    // X-Forwarded-Host header
//   forwardedProto: string | null,   // X-Forwarded-Proto header (may be overwritten by Caddy)
//   envRedirectUri: string | null    // GOOGLE_REDIRECT_URI env var (reference)
// }
//
// NOTE: visiting this endpoint from different places returns different URIs:
//   • From localhost:3000 directly  → http://localhost:3000/api/integrations/google/callback
//   • From the HTTPS preview URL    → https://<preview-host>/api/integrations/google/callback
// Both URIs must be registered in Google Cloud Console for the OAuth flow to
// work end-to-end in both environments.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import {
  getGoogleOAuthConfig,
  GOOGLE_SCOPES,
  isGoogleConfigured,
  resolvePublicOrigin,
  resolveRedirectUri,
} from '@/lib/google-workspace';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  const origin = resolvePublicOrigin(req);
  const redirectUri = resolveRedirectUri(req);

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const envRedirectUri = process.env.GOOGLE_REDIRECT_URI;

  // Resolve static config safely (won't throw even if creds are missing).
  const config = (() => {
    try {
      return getGoogleOAuthConfig();
    } catch {
      return null;
    }
  })();

  return NextResponse.json({
    ok: true,
    timestamp: new Date().toISOString(),
    configured: isGoogleConfigured(),
    redirectUri,                                  // ← the EXACT URI sent to Google
    origin,                                       // resolved public origin
    redirectUriSource: envRedirectUri ? 'env' : 'dynamic',
    registeredUrisExpected: {
      env: envRedirectUri ?? '(not set — derived from request origin)',
    },
    clientIdPrefix: clientId
      ? clientId.slice(0, 20) + (clientId.length > 20 ? '…' : '')
      : null,
    scopes: GOOGLE_SCOPES.split(' '),
    envVars: {
      GOOGLE_CLIENT_ID: Boolean(clientId),
      GOOGLE_CLIENT_SECRET: Boolean(clientSecret),
      GOOGLE_REDIRECT_URI: Boolean(envRedirectUri),
      GOOGLE_OAUTH_STATE_SECRET: Boolean(process.env.GOOGLE_OAUTH_STATE_SECRET),
      GOOGLE_OAUTH_STATE_STRICT: process.env.GOOGLE_OAUTH_STATE_STRICT === 'true',
    },
    requestHeaders: {
      host: req.headers.get('host'),
      origin: req.headers.get('origin'),
      abc: req.headers.get('abc') ? '(present — Z.ai gateway)' : null,
      xForwardedHost: req.headers.get('x-forwarded-host'),
      xForwardedProto: req.headers.get('x-forwarded-proto'),
    },
    googleConsoleRequirements: {
      authorizedJavaScriptOrigins: [origin],
      authorizedRedirectUris: [redirectUri],
      note:
        'Register the redirect URI above EXACTLY (protocol + host + port + path) in Google Cloud Console → APIs & Services → Credentials → your OAuth 2.0 Client → Authorized redirect URIs. For local dev AND production, register BOTH URIs. Also enable the Gmail, Drive, Sheets, and Calendar APIs for your project.',
    },
    config: config
      ? {
          clientIdPresent: Boolean(config.clientId),
          clientSecretPresent: Boolean(config.clientSecret),
          redirectUriFromConfig: config.redirectUri,
        }
      : null,
  });
}
