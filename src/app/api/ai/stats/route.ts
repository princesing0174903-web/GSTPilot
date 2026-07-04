// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot AI Production Pipeline™ — Stats
//
// GET /api/ai/stats?orgId=
//
// Returns aggregated pipeline stats for an organization: total jobs, by status,
// by asset type, by provider, avg duration, total cost, success rate, last 24h
// count. Computed server-side from the ai_jobs collection.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { computeStats } from '@/lib/ai-pipeline/server/processor';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const organizationId = searchParams.get('orgId');

    if (!organizationId) {
      return NextResponse.json({ error: 'orgId query param is required' }, { status: 400 });
    }

    const stats = await computeStats(organizationId);
    return NextResponse.json({ ok: true, stats });
  } catch (err) {
    console.error('[api/ai/stats] error:', err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
