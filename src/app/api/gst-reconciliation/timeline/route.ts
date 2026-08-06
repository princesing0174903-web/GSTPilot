// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/gst-reconciliation/timeline
// ═══════════════════════════════════════════════════════════════════════════════
// Fetch reconciliation history for a GSTIN/org — monthly trend.
//
// Query: ?organizationId=...&gstin=...&months=6
//
// Returns: {
//   timeline: Array<{
//     period: string,         // YYYY-MM
//     periodLabel: string,    // "Aug 2026"
//     runId: string | null,
//     matchPercent: number,
//     potentialITCLoss: number,
//     totalBooks: number,
//     total2B: number,
//     status: 'completed' | 'pending' | 'running',
//     ranAt: string | null,
//   }>,
//   trend: 'improving' | 'declining' | 'stable' | 'insufficient_data',
//   avgMatchPercent: number,
//   bestMonth: { period: string; matchPercent: number } | null,
//   worstMonth: { period: string; matchPercent: number } | null,
// }
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth, requireOrgMembership, friendlyApiError } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

function getMonthLabel(yyyymm: string): string {
  const [y, m] = yyyymm.split('-').map(Number);
  if (!y || !m) return yyyymm;
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
}

export async function GET(request: Request) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;
    const { uid } = authResult;

    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');
    const gstin = searchParams.get('gstin');
    const months = Math.min(Math.max(Number(searchParams.get('months') || '6'), 1), 24);

    if (!organizationId) {
      return NextResponse.json(
        { error: 'organizationId is required', code: 'MISSING_PARAMS' },
        { status: 400 },
      );
    }

    const memberResult = await requireOrgMembership(uid, organizationId);
    if (memberResult instanceof NextResponse) return memberResult;

    // Build the list of the last N months (YYYY-MM)
    const now = new Date();
    const monthList: string[] = [];
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthList.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }

    // Fetch runs for the org (optionally filtered by gstin) in the last N months
    const where: Record<string, unknown> = {
      organizationId,
      period: { in: monthList },
    };
    if (gstin) where.gstin = gstin;

    const runs = await db.gSTReconciliationRun.findMany({
      where,
      orderBy: { period: 'asc' },
      select: {
        id: true,
        period: true,
        gstin: true,
        matchPercent: true,
        potentialITCLoss: true,
        totalBooks: true,
        total2B: true,
        status: true,
        startedAt: true,
        completedAt: true,
      },
    });

    // Group by period (keep the latest run per period if multiple)
    const runsByPeriod = new Map<string, typeof runs[number]>();
    for (const r of runs) {
      const existing = runsByPeriod.get(r.period);
      if (!existing || r.startedAt > existing.startedAt) {
        runsByPeriod.set(r.period, r);
      }
    }

    // Build the timeline
    const timeline = monthList.map((period) => {
      const run = runsByPeriod.get(period);
      if (run) {
        return {
          period,
          periodLabel: getMonthLabel(period),
          runId: run.id,
          matchPercent: run.matchPercent,
          potentialITCLoss: run.potentialITCLoss,
          totalBooks: run.totalBooks,
          total2B: run.total2B,
          status: run.status as 'completed' | 'pending' | 'running',
          ranAt: run.completedAt?.toISOString() ?? run.startedAt.toISOString(),
        };
      }
      // Pending (no run yet for this month)
      return {
        period,
        periodLabel: getMonthLabel(period),
        runId: null,
        matchPercent: 0,
        potentialITCLoss: 0,
        totalBooks: 0,
        total2B: 0,
        status: 'pending' as const,
        ranAt: null,
      };
    });

    // Compute trend
    const completedMonths = timeline.filter((t) => t.status === 'completed' && t.matchPercent > 0);
    let trend: 'improving' | 'declining' | 'stable' | 'insufficient_data' = 'insufficient_data';
    let avgMatchPercent = 0;
    let bestMonth: { period: string; matchPercent: number } | null = null;
    let worstMonth: { period: string; matchPercent: number } | null = null;

    if (completedMonths.length >= 2) {
      const first = completedMonths[0].matchPercent;
      const last = completedMonths[completedMonths.length - 1].matchPercent;
      const diff = last - first;
      if (diff >= 5) trend = 'improving';
      else if (diff <= -5) trend = 'declining';
      else trend = 'stable';

      avgMatchPercent = Math.round(
        completedMonths.reduce((s, m) => s + m.matchPercent, 0) / completedMonths.length,
      );

      const sorted = [...completedMonths].sort((a, b) => b.matchPercent - a.matchPercent);
      bestMonth = { period: sorted[0].period, matchPercent: sorted[0].matchPercent };
      worstMonth = {
        period: sorted[sorted.length - 1].period,
        matchPercent: sorted[sorted.length - 1].matchPercent,
      };
    } else if (completedMonths.length === 1) {
      avgMatchPercent = completedMonths[0].matchPercent;
      bestMonth = { period: completedMonths[0].period, matchPercent: completedMonths[0].matchPercent };
      worstMonth = bestMonth;
    }

    return NextResponse.json({
      timeline,
      trend,
      avgMatchPercent,
      bestMonth,
      worstMonth,
    });
  } catch (error) {
    return friendlyApiError(error, 'Could not load reconciliation timeline.');
  }
}
