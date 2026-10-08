// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO AI Oracle™ & AI CFO™ — Insights API
//
// GET  /api/ai/insights?orgId=         — read insights (regenerates live + persists)
// POST /api/ai/insights                — regenerate
//   Body: { organizationId }
//
// Returns: { ok: true, insights: Insight[] }
//
// Wraps all errors with friendlyAIError. NoBusinessDataError → 409.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { generateInsights } from '@/lib/ai-provider/server/orchestrator';
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

    const insights = await generateInsights(organizationId);
    return NextResponse.json({ ok: true, insights });
  } catch (err) {
    if (err instanceof NoBusinessDataError) {
      return NextResponse.json(
        { ok: false, error: friendlyAIError(err), code: err.code },
        { status: 409 },
      );
    }
    if (err instanceof AIError) {
      console.error('[api/ai/insights] GET error:', err.code, friendlyAIError(err));
      return NextResponse.json(
        { ok: false, error: friendlyAIError(err), code: err.code },
        { status: err.statusCode },
      );
    }
    console.error('[api/ai/insights] GET unknown error:', err);
    return NextResponse.json(
      { ok: false, error: friendlyAIError(err) },
      { status: 500 },
    );
  }
}

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

    const insights = await generateInsights(organizationId);
    return NextResponse.json({ ok: true, insights });
  } catch (err) {
    if (err instanceof NoBusinessDataError) {
      return NextResponse.json(
        { ok: false, error: friendlyAIError(err), code: err.code },
        { status: 409 },
      );
    }
    if (err instanceof AIError) {
      console.error('[api/ai/insights] POST error:', err.code, friendlyAIError(err));
      return NextResponse.json(
        { ok: false, error: friendlyAIError(err), code: err.code },
        { status: err.statusCode },
      );
    }
    console.error('[api/ai/insights] POST unknown error:', err);
    return NextResponse.json(
      { ok: false, error: friendlyAIError(err) },
      { status: 500 },
    );
  }
}
