// ═══════════════════════════════════════════════════════════════════════════════
// /api/integrations/google/redirect-uri — Debug endpoint
//
// GET /api/integrations/google/redirect-uri
//   Returns the OAuth redirect URI that the connect/callback routes will
//   derive from the current request's forwarded headers. Use this to verify
//   exactly which URI must be registered in Google Cloud Console →
//   Credentials → OAuth 2.0 Client → "Authorized redirect URIs".
//
// Response: {
//   ok: true,
//   redirectUri: string,             // the full URI to register in Google Cloud
//   origin: string,                  // the resolved public origin
//   host: string | null,             // Host header
//   forwardedHost: string | null,    // X-Forwarded-Host header
//   forwardedProto: string | null,   // X-Forwarded-Proto header
//   envRedirectUri: string | null    // GOOGLE_REDIRECT_URI env var (for reference)
// }
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
