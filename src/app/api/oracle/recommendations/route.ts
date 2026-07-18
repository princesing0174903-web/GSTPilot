// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle™ — Dynamic Recommendations API (PT-1-b)
// GET /api/oracle/recommendations?userId=<firebase_uid>
//
// Returns 3-5 actionable recommendations computed dynamically from REAL DB
// state (Invoice, GSTRFiling, Notice, Issue, Payment, Expense, FilingEvent,
// ExecutiveReport). No static / canned items — when the DB is empty, Oracle
// returns a single recommendation to connect data sources.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { generateDynamicRecommendations } from '@/lib/oracle/real-data';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId') ?? undefined;
  // AUDIT-DUP-1 fix: pass organizationId through so generateDynamicRecommendations
  // can (a) org-scope every Prisma read, (b) source headline cash/revenue/
  // expenses from the Business Snapshot instead of global Prisma aggregates.
  const organizationId = request.nextUrl.searchParams.get('organizationId') ?? undefined;

  try {
    const recommendations = await generateDynamicRecommendations(organizationId, userId);
    return NextResponse.json(
      {
        success: true,
        count: recommendations.length,
        recommendations,
        generatedAt: new Date().toISOString(),
        userId: userId ?? null,
        organizationId: organizationId ?? null,
      },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } },
    );
  } catch (err) {
    console.error('[oracle/recommendations] error', err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to generate recommendations',
        recommendations: [],
      },
      { status: 500 },
    );
  }
}
