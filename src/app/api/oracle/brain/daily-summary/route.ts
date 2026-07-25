// ═══════════════════════════════════════════════════════════════════════════════
// Oracle Brain — Daily Summary API
// GET /api/oracle/brain/daily-summary?firmId=...
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { getDailySummary } from '@/lib/oracle/brain/daily-summary';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const firmId = url.searchParams.get('firmId') || 'preview-org';
    const userId = url.searchParams.get('userId') || undefined;
    const summary = await getDailySummary(firmId, userId);
    return NextResponse.json({ ok: true, data: summary });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
