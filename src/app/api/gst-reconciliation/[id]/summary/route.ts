// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/gst-reconciliation/[id]/summary
// ═══════════════════════════════════════════════════════════════════════════════
// Fetch the AI CFO summary for a run (missing/dupes/wrong GST, ITC blocked,
// expected recovery, risk level, top issues, action items).
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth, requireOrgMembership, friendlyApiError } from '@/lib/auth/session';
import { generateAISummary } from '@/lib/gst-reconciliation';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;
    const { uid } = authResult;

    const { id: runId } = await params;

    const run = await db.gSTReconciliationRun.findUnique({ where: { id: runId } });
    if (!run) {
      return NextResponse.json({ error: 'Run not found', code: 'NOT_FOUND' }, { status: 404 });
    }

    const memberResult = await requireOrgMembership(uid, run.organizationId);
    if (memberResult instanceof NextResponse) return memberResult;

    if (run.aiSummary) {
      try {
        const summary = JSON.parse(run.aiSummary);
        return NextResponse.json({ summary, cached: true });
      } catch {
        // fall through to regenerate
      }
    }

    const matches = await db.gSTReconciliationMatch.findMany({
      where: { runId },
      select: {
        status: true,
        itcAtRisk: true,
        booksTaxableValue: true,
        gstr2bTaxableValue: true,
        confidence: true,
      },
    });

    const summary = generateAISummary(
      {
        totalBooks: run.totalBooks,
        total2B: run.total2B,
        matched: run.matched,
        unmatched: run.unmatched,
        missingInBooks: run.missingInBooks,
        missingIn2B: run.missingIn2B,
        duplicates: run.duplicates,
        matchPercent: run.matchPercent,
        potentialITCLoss: run.potentialITCLoss,
        totalTaxableValue: run.totalTaxableValue,
        totalMatchedTax: run.totalMatchedTax,
        avgConfidence: matches.length > 0
          ? matches.reduce((s, m) => s + (m.confidence || 0), 0) / matches.length
          : 0,
      },
      matches.map((m) => ({
        status: m.status as never,
        itcAtRisk: m.itcAtRisk,
        booksTaxableValue: m.booksTaxableValue,
        gstr2bTaxableValue: m.gstr2bTaxableValue,
        confidence: m.confidence,
      })),
    );

    await db.gSTReconciliationRun.update({
      where: { id: runId },
      data: { aiSummary: JSON.stringify(summary) },
    });

    return NextResponse.json({ summary, cached: false });
  } catch (error) {
    return friendlyApiError(error, 'Could not load AI summary.');
  }
}
