// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/oracle/briefing?userId=<firebase_uid>
//
// Returns the structured OracleBriefing JSON for the given user. This is the
// HTTP surface for the VEYRO AI Intelligence Engine — the engine itself lives
// in `@/lib/oracle/oracle-engine.ts` and exposes ONE function:
// `generateOracleBriefing(userId)`.
//
// The route is a thin pass-through: it validates the userId, calls the engine,
// and returns the briefing. All heavy lifting (collection, analysis, ranking,
// briefing assembly) happens in the library.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireOrgMembership, friendlyApiError } from '@/lib/auth/session';
import { generateOracleBriefing } from '@/lib/oracle/oracle-engine';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  // ─── AUTH GUARD (ORACLE-AUTH-GUARDS) ──
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;
  const { uid } = authResult;

  const userId = request.nextUrl.searchParams.get('userId');
  if (!userId) {
    return NextResponse.json(
      { error: 'userId is required', usage: '/api/oracle/briefing?userId=<firebase_uid>' },
      { status: 400 },
    );
  }

  // Optional orgId check — pass via query if available
  const orgId0 = request.nextUrl.searchParams.get('orgId') || request.nextUrl.searchParams.get('organizationId') || request.nextUrl.searchParams.get('firmId') || '';
  if (orgId0) {
    const orgResult = await requireOrgMembership(uid, orgId0);
    if (orgResult instanceof NextResponse) return orgResult;
  }

  try {
    const briefing = await generateOracleBriefing(userId);
    return NextResponse.json(briefing);
  } catch (err) {
    console.error('[Oracle Briefing] Error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error generating briefing';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
