// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle™ — Universal Search API
//
// GET /api/oracle/search?q=<query> → searches clients, invoices, returns,
//                                     reports, documents, tasks, notices.
//
// Response:
//   { ok: true, results: SearchResult[], query: string }
//
// Queries shorter than 2 characters return an empty result set instantly
// (no DB hit).
// ═══════════════════════════════════════════════════════════════════════════════

import { searchAll } from '@/lib/oracle/search';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireOrgMembership, friendlyApiError } from '@/lib/auth/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // ─── AUTH GUARD (ORACLE-AUTH-GUARDS) ──
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;
  const { uid } = authResult;
  const url = new URL(request.url);
  const orgId0 = url.searchParams.get('orgId') || url.searchParams.get('organizationId') || url.searchParams.get('firmId') || '';
  if (orgId0) {
    const orgResult = await requireOrgMembership(uid, orgId0);
    if (orgResult instanceof NextResponse) return orgResult;
  }

  const q = url.searchParams.get('q')?.trim() ?? '';
  if (q.length < 2) {
    return Response.json({ ok: true, results: [] });
  }

  try {
    const results = await searchAll(q);
    return Response.json({ ok: true, results, query: q });
  } catch (error) {
    // Never surface a 500 — return an empty result set instead.
    console.error('GET /api/oracle/search error:', error);
    return Response.json({ ok: true, results: [], query: q });
  }
}
