// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO AI Oracle™ & AI CFO™ — Analyze API
//
// POST /api/ai/analyze
//   Body: { organizationId, module?: 'business' | 'cashflow' | 'gst' | 'invoices' | 'expenses' }
//   module defaults to 'business'.
//
// Returns:
//   • module='business' (or undefined) → { ok, context, insights, recommendations,
//     alerts, businessScore, riskScore, brief }
//   • module=<other>                    → { ok, result: AnalysisResult }
//
// Wraps all errors with friendlyAIError. NoBusinessDataError → 409.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { analyzeBusiness, analyzeModule } from '@/lib/ai-provider/server/orchestrator';
import { AIError, NoBusinessDataError, friendlyAIError } from '@/lib/ai-provider';
import type { AnalysisModule } from '@/lib/ai-provider';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const VALID_MODULES: AnalysisModule[] = ['business', 'cashflow', 'gst', 'invoices', 'expenses'];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { organizationId, module = 'business' } = body as {
      organizationId?: string;
      module?: AnalysisModule;
    };

    if (!organizationId) {
      return NextResponse.json(
        { ok: false, error: 'You must belong to an organization to use AI Oracle.', code: 'NO_ORGANIZATION' },
        { status: 403 },
      );
    }

    if (!VALID_MODULES.includes(module)) {
      return NextResponse.json(
        { ok: false, error: `Invalid module. Must be one of: ${VALID_MODULES.join(', ')}.`, code: 'AI_VALIDATION_ERROR' },
        { status: 400 },
      );
    }

    if (module === 'business') {
      const result = await analyzeBusiness(organizationId);
      return NextResponse.json({ ok: true, ...result });
    }

    const result = await analyzeModule(organizationId, module);
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    if (err instanceof NoBusinessDataError) {
      return NextResponse.json(
        { ok: false, error: friendlyAIError(err), code: err.code },
        { status: 409 },
      );
    }
    if (err instanceof AIError) {
      console.error('[api/ai/analyze] error:', err.code, friendlyAIError(err));
      return NextResponse.json(
        { ok: false, error: friendlyAIError(err), code: err.code },
        { status: err.statusCode },
      );
    }
    console.error('[api/ai/analyze] unknown error:', err);
    return NextResponse.json(
      { ok: false, error: friendlyAIError(err) },
      { status: 500 },
    );
  }
}
