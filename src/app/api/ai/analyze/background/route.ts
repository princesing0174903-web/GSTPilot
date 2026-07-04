// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot AI Oracle™ & AI CFO™ — Background Analysis API
//
// POST /api/ai/analyze/background
//   Body: { organizationId? }     (orgId may be passed in the body)
//
// Returns: { ok: true, insightsCount, recommendationsCount, brief }
//
// Refreshes the org's AI memory: clears stale insights/recommendations,
// regenerates fresh ones from the latest Firestore data, and stores an analysis
// memory entry so the Oracle "remembers" this run.
//
// If the org has no business data yet, returns counts=0 with a graceful brief
// (does NOT throw NoBusinessDataError).
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { runBackgroundAnalysis } from '@/lib/ai-provider/server/orchestrator';
import { AIError, friendlyAIError } from '@/lib/ai-provider';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { organizationId } = body as { organizationId?: string };

    if (!organizationId) {
      return NextResponse.json(
        { ok: false, error: 'You must belong to an organization to use AI Oracle.', code: 'NO_ORGANIZATION' },
        { status: 403 },
      );
    }

    const result = await runBackgroundAnalysis(organizationId);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof AIError) {
      console.error('[api/ai/analyze/background] error:', err.code, friendlyAIError(err));
      return NextResponse.json(
        { ok: false, error: friendlyAIError(err), code: err.code },
        { status: err.statusCode },
      );
    }
    console.error('[api/ai/analyze/background] unknown error:', err);
    return NextResponse.json(
      { ok: false, error: friendlyAIError(err) },
      { status: 500 },
    );
  }
}
