// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/data/pipelines?limit=<number>
// Real-Time Data Pipeline™ — returns recent pipeline runs + aggregate summary.
// All data is REAL production data pulled from the Data Intelligence Cloud™ lib.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { getPipelineRuns, getPipelineSummary } from '@/lib/data-intelligence';

export async function GET(request: NextRequest) {
  try {
    const rawLimit = request.nextUrl.searchParams.get('limit');
    const parsed = rawLimit ? Number.parseInt(rawLimit, 10) : NaN;
    const limit = Number.isFinite(parsed) && parsed > 0 ? parsed : 50;

    const [runs, summary] = await Promise.all([
      getPipelineRuns(limit),
      getPipelineSummary(),
    ]);

    return NextResponse.json({ ok: true, runs, summary });
  } catch (err) {
    console.error('[/api/data/pipelines] Error:', err);
    return NextResponse.json(
      { ok: false, error: 'Failed to load pipeline data', runs: [], summary: null },
      { status: 500 },
    );
  }
}
