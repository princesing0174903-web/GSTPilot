// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot AI Oracle™ & AI CFO™ — Predictions API
//
// POST /api/ai/predict
//   Body: { organizationId, metric: 'revenue' | 'cashflow', months?: number }
//   months defaults to 3.
//
// Returns: { ok: true, prediction: Prediction }
//
// Wraps all errors with friendlyAIError. NoBusinessDataError → 409.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { predictRevenue, predictCashFlow } from '@/lib/ai-provider/server/orchestrator';
import { AIError, NoBusinessDataError, friendlyAIError } from '@/lib/ai-provider';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { organizationId, metric, months = 3 } = body as {
      organizationId?: string;
      metric?: 'revenue' | 'cashflow';
      months?: number;
    };

    if (!organizationId) {
      return NextResponse.json(
        { ok: false, error: 'You must belong to an organization to use AI Oracle.', code: 'NO_ORGANIZATION' },
        { status: 403 },
      );
    }

    if (metric !== 'revenue' && metric !== 'cashflow') {
      return NextResponse.json(
        { ok: false, error: "metric must be 'revenue' or 'cashflow'.", code: 'AI_VALIDATION_ERROR' },
        { status: 400 },
      );
    }

    // Clamp months to a sane range.
    const m = Math.max(1, Math.min(24, Math.floor(Number(months) || 3)));

    const prediction =
      metric === 'revenue'
        ? await predictRevenue(organizationId, m)
        : await predictCashFlow(organizationId, m);

    return NextResponse.json({ ok: true, prediction });
  } catch (err) {
    if (err instanceof NoBusinessDataError) {
      return NextResponse.json(
        { ok: false, error: friendlyAIError(err), code: err.code },
        { status: 409 },
      );
    }
    if (err instanceof AIError) {
      console.error('[api/ai/predict] error:', err.code, friendlyAIError(err));
      return NextResponse.json(
        { ok: false, error: friendlyAIError(err), code: err.code },
        { status: err.statusCode },
      );
    }
    console.error('[api/ai/predict] unknown error:', err);
    return NextResponse.json(
      { ok: false, error: friendlyAIError(err) },
      { status: 500 },
    );
  }
}
