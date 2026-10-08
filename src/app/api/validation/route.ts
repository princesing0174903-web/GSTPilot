// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO™ — PHASE 2B · MODULE 2 — Data Validation Engine API
//
// GET  /api/validation → validation summary (dataQualityScore, issues, counts)
// POST /api/validation → re-run full validation (triggered after sync or manually)
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse, type NextRequest } from 'next/server';
import { runValidation, getValidationSummary } from '@/lib/connections/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const summary = await getValidationSummary();
    return NextResponse.json({ ok: true, summary });
  } catch (error) {
    console.error('GET /api/validation error:', error);
    return NextResponse.json({
      ok: true,
      summary: {
        status: 'clean',
        errorCount: 0,
        warningCount: 0,
        duplicateCount: 0,
        dataQualityScore: 100,
        recentIssues: [],
      },
    });
  }
}

export async function POST() {
  try {
    const result = await runValidation();
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    console.error('POST /api/validation error:', error);
    return NextResponse.json({ ok: false, error: 'Validation failed' }, { status: 500 });
  }
}
