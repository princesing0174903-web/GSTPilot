// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/auth/github/logout
// ═══════════════════════════════════════════════════════════════════════════════
//
// Clears the `gstpilot_session_jwt` cookie. Returns 200 OK on success.
//
// AuthContext calls this when the user logs out of a GitHub session.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { clearSessionCookieHeader } from '@/lib/integrations/github/session';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  // Detect HTTPS from the same origin logic the callback uses.
  const url = new URL(req.url);
  const fwdProto = req.headers.get('x-forwarded-proto');
  const host = req.headers.get('host') ?? url.host;
  const isLocal = host.startsWith('localhost') || host.startsWith('127.');
  const isHttps = (fwdProto ?? (isLocal ? 'http' : 'https')) === 'https';

  const res = NextResponse.json({ ok: true });
  res.headers.set('Set-Cookie', clearSessionCookieHeader(isHttps));
  return res;
}
