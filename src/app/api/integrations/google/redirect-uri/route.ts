// ═══════════════════════════════════════════════════════════════════════════════
// /api/integrations/google/redirect-uri — Debug endpoint
//
// GET /api/integrations/google/redirect-uri
//   Returns the OAuth redirect URI that the connect/callback routes will
//   send to Google. This is always `GOOGLE_REDIRECT_URI` from the env (with
//   a localhost fallback). Use this to verify exactly which URI must be
//   registered in Google Cloud Console → Credentials → OAuth 2.0 Client →
//   "Authorized redirect URIs".
//
// Response: {
//   ok: true,
//   redirectUri: string,   // the URI sent to Google (= GOOGLE_REDIRECT_URI env)
//   envRedirectUri: string // raw env var value (same as redirectUri, for clarity)
// }
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { getRedirectUri } from '@/lib/google-workspace';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const redirectUri = getRedirectUri();
  return NextResponse.json({
    ok: true,
    redirectUri,
    envRedirectUri: process.env.GOOGLE_REDIRECT_URI ?? null,
  });
}
