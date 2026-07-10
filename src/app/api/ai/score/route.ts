// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot AI Oracle™ & AI CFO™ — Scores API
//
// GET /api/ai/score?orgId=         — composite BusinessScore + RiskScore (parallel)
//
// Returns: { ok: true, businessScore: BusinessScore, riskScore: RiskScore }
//
// Wraps all errors with friendlyAIError. NoBusinessDataError → 409.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { computeBusinessScore, computeRiskScore } from '@/lib/ai-provider/server/orchestrator';
import { AIError, NoBusinessDataError, friendlyAIError } from '@/lib/ai-provider';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const organizationId = searchParams.get('orgId');

    if (!organizationId) {
      return NextResponse.json(
        { ok: false, error: 'orgId query param is required.', code: 'NO_ORGANIZATION' },
        { status: 403 },
      );
    }

    const [businessScore, riskScore] = await Promise.all([
      computeBusinessScore(organizationId),
      computeRiskScore(organizationId),
    ]);

    return NextResponse.json({ ok: true, businessScore, riskScore });
  } catch (err) {
    if (err instanceof NoBusinessDataError) {
      return NextResponse.json(
        { ok: false, error: friendlyAIError(err), code: err.code },
        { status: 409 },
      );
    }
    if (err instanceof AIError) {
      console.error('[api/ai/score] GET error:', err.code, friendlyAIError(err));
      return NextResponse.json(
        { ok: false, error: friendlyAIError(err), code: err.code },
        { status: err.statusCode },
      );
    }
    console.error('[api/ai/score] GET unknown error:', err);
    return NextResponse.json(
      { ok: false, error: friendlyAIError(err) },
      { status: 500 },
    );
  }
}
