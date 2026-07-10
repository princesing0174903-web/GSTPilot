// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/data/analytics?type=<AnalyticsType>
// Enterprise Analytics Engine™ — returns analytics snapshots + summary + the
// most recent snapshot per analyticsType. All data is REAL production data.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import {
  getAnalytics,
  getAnalyticsSummary,
  getLatestAnalytics,
} from '@/lib/data-intelligence';
import type { AnalyticsType } from '@/lib/data-intelligence/types';

export async function GET(request: NextRequest) {
  try {
    const typeParam = request.nextUrl.searchParams.get('type');
    const type = (typeParam || undefined) as AnalyticsType | undefined;

    const [snapshots, summary, latest] = await Promise.all([
      getAnalytics(type),
      getAnalyticsSummary(),
      getLatestAnalytics(),
    ]);

    return NextResponse.json({ ok: true, snapshots, summary, latest });
  } catch (err) {
    console.error('[/api/data/analytics] Error:', err);
    return NextResponse.json(
      {
        ok: false,
        error: 'Failed to load analytics',
        snapshots: [],
        summary: null,
        latest: [],
      },
      { status: 500 },
    );
  }
}
