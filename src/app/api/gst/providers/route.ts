// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/gst/providers
// ═══════════════════════════════════════════════════════════════════════════════
// Returns the list of supported GSP providers + their required config fields.
// This is PUBLIC metadata (no secrets) — used by the Settings page to render
// the provider picker. Auth-gated so only logged-in users see it.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/session';
import { listGSPProviders } from '@/lib/gst-reconciliation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const providers = listGSPProviders();
  return NextResponse.json({ ok: true, providers });
}
