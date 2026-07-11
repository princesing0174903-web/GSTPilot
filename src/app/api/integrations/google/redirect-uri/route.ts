// ═══════════════════════════════════════════════════════════════════════════════
// /api/integrations/google/redirect-uri — Debug endpoint
//
// GET /api/integrations/google/redirect-uri
//   Returns the OAuth redirect URI that the connect/callback routes will
//   derive from the current request's forwarded headers, plus the raw header
//   values for transparency. Use this to verify exactly which URI must be
//   registered in Google Cloud Console → Credentials → OAuth 2.0 Client →
//   "Authorized redirect URIs" for the current access path.
//
// Response: {
//   ok: true,
//   redirectUri: string,             // the URI sent to Google (= what to register)
//   origin: string,                  // the resolved public origin
//   host: string | null,             // Host header
//   forwardedHost: string | null,    // X-Forwarded-Host header
//   forwardedProto: string | null,   // X-Forwarded-Proto header
//   envRedirectUri: string | null    // GOOGLE_REDIRECT_URI env var (reference only)
// }
//
// NOTE: visiting this endpoint from different places returns different URIs:
//   • From localhost:3000 directly  → http://localhost:3000/api/integrations/google/callback
//   • From the preview URL          → http://<preview-host>/api/integrations/google/callback
// Both URIs must be registered in Google Cloud Console for the OAuth flow to
// work end-to-end in both environments.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { resolvePublicOrigin, resolveRedirectUri } from '@/lib/google-workspace';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  const origin = resolvePublicOrigin(req);
  const redirectUri = resolveRedirectUri(req);
  return NextResponse.json({
    ok: true,
    redirectUri,
    origin,
    host: req.headers.get('host'),
    forwardedHost: req.headers.get('x-forwarded-host'),
    forwardedProto: req.headers.get('x-forwarded-proto'),
    envRedirectUri: process.env.GOOGLE_REDIRECT_URI ?? null,
  });
}
