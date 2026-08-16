// ═══════════════════════════════════════════════════════════════════════════════
// Oracle Brain — Daily Summary API
// GET /api/oracle/brain/daily-summary?firmId=...
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireOrgMembership, friendlyApiError } from '@/lib/auth/session';
import { getDailySummary } from '@/lib/oracle/brain/daily-summary';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // ─── AUTH GUARD (ORACLE-AUTH-GUARDS) ──
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;
  const { uid } = authResult;
  const url = new URL(req.url);
  const orgId0 = url.searchParams.get('firmId') || url.searchParams.get('orgId') || '';
  const orgResult = await requireOrgMembership(uid, orgId0);
  if (orgResult instanceof NextResponse) return orgResult;

  try {
    const firmId = url.searchParams.get('firmId') || url.searchParams.get('orgId') || 'preview-org';
    const userId = url.searchParams.get('userId') || undefined;
    const summary = await getDailySummary(firmId, userId);
    return NextResponse.json({ ok: true, data: summary });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
