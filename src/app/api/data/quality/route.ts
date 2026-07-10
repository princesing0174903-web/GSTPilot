// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/data/quality
//   ?scan=true   → run a fresh quality scan, then return refreshed issues + summary
//   (no params)  → return current issues + summary
// Founder & Owner: Prince Singh. Every Data Point. One Enterprise Brain.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import {
  getQualityIssues,
  getQualitySummary,
  runQualityScan,
} from '@/lib/data-intelligence';

export async function GET(request: NextRequest) {
  try {
    const scan = request.nextUrl.searchParams.get('scan');

    if (scan === 'true') {
      const issues = await runQualityScan();
      const summary = await getQualitySummary();
      return NextResponse.json({ ok: true, refreshed: true, issues, summary });
    }

    const [issues, summary] = await Promise.all([
      getQualityIssues(),
      getQualitySummary(),
    ]);

    return NextResponse.json({ ok: true, issues, summary });
  } catch (err) {
    console.error('[data-intelligence/quality] Error:', err);
    const message =
      err instanceof Error ? err.message : 'Failed to load data quality';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
