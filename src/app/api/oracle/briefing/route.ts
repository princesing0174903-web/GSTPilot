// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/oracle/briefing?userId=<firebase_uid>
//
// Returns the structured OracleBriefing JSON for the given user. This is the
// HTTP surface for the Oracle Intelligence Engine — the engine itself lives
// in `@/lib/oracle/oracle-engine.ts` and exposes ONE function:
// `generateOracleBriefing(userId)`.
//
// The route is a thin pass-through: it validates the userId, calls the engine,
// and returns the briefing. All heavy lifting (collection, analysis, ranking,
// briefing assembly) happens in the library.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { generateOracleBriefing } from '@/lib/oracle/oracle-engine';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId');
  if (!userId) {
    return NextResponse.json(
      { error: 'userId is required', usage: '/api/oracle/briefing?userId=<firebase_uid>' },
      { status: 400 },
    );
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
