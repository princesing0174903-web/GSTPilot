// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/auth/github/session
// ═══════════════════════════════════════════════════════════════════════════════
//
// Reads the `gstpilot_session_jwt` cookie (set by /api/auth/github/callback),
// verifies it, and returns the identity claims as the AuthUser shape that
// AuthContext expects.
//
// This is the bridge between the GitHub OAuth cookie session (server-side)
// and the existing AuthContext (client-side). When AuthContext detects
// `?github_connected=1` in the URL on app load, it calls this endpoint to
// hydrate the user without going through Firebase Auth.
//
// RESPONSE:
//   200 OK  — { ok: true, user: { id, email, name, picture, provider, emailVerified } }
//   401     — { ok: false, error: '...', code: 'AUTH_REQUIRED' }  (no valid cookie)
//
// SECURITY:
//   • Reads ONLY the httpOnly cookie — never accepts the identity from a
//     query param or request body.
//   • The JWT is verified locally (HMAC-SHA256) — no Admin SDK needed.
//   • Never returns the GitHub access token (we don't store it anyway).
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyJwt } from '@/lib/integrations/github/session';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function parseCookie(cookieHeader: string): Map<string, string> {
  const out = new Map<string, string>();
  if (!cookieHeader) return out;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx <= 0) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key) out.set(key, decodeURIComponent(value));
  }
  return out;
}

export async function GET(req: Request) {
  const cookieStore = cookies();
  const jwtCookie = cookieStore.get('gstpilot_session_jwt')?.value;

  if (!jwtCookie) {
    return NextResponse.json(
      { ok: false, error: 'No GitHub session found.', code: 'AUTH_REQUIRED' },
      { status: 401 }
    );
  }

  const claims = verifyJwt(jwtCookie);
  if (!claims || claims.provider !== 'github') {
    return NextResponse.json(
      { ok: false, error: 'Your GitHub session has expired. Please sign in again.', code: 'SESSION_EXPIRED' },
      { status: 401 }
    );
  }

  return NextResponse.json({
    ok: true,
    user: {
      id: claims.uid,
      email: claims.email,
      name: claims.name,
      picture: claims.picture,
      provider: 'github' as const,
      emailVerified: claims.emailVerified,
    },
  });
}
