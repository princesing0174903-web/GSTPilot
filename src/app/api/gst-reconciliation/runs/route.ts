// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/gst-reconciliation/runs
// ═══════════════════════════════════════════════════════════════════════════════
// List reconciliation runs for an org (optionally filtered by gstin/period).
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth, requireOrgMembership, friendlyApiError } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;
    const { uid } = authResult;

    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');
    const gstin = searchParams.get('gstin');
    const period = searchParams.get('period');
    const limit = Math.min(Number(searchParams.get('limit') || '20'), 100);

    if (!organizationId) {
      return NextResponse.json({ error: 'organizationId is required', code: 'MISSING_PARAMS' }, { status: 400 });
    }

    const memberResult = await requireOrgMembership(uid, organizationId);
    if (memberResult instanceof NextResponse) return memberResult;

    const where: Record<string, unknown> = { organizationId };
    if (gstin) where.gstin = gstin;
    if (period) where.period = period;

    const runs = await db.gSTReconciliationRun.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        gstin: true,
        period: true,
        gspProvider: true,
        status: true,
        totalBooks: true,
        total2B: true,
        matched: true,
        unmatched: true,
        missingInBooks: true,
        missingIn2B: true,
        duplicates: true,
        matchPercent: true,
        potentialITCLoss: true,
        totalTaxableValue: true,
        totalMatchedTax: true,
        startedAt: true,
        completedAt: true,
        durationMs: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ runs });
  } catch (error) {
    return friendlyApiError(error, 'Could not load reconciliation runs.');
  }
}
