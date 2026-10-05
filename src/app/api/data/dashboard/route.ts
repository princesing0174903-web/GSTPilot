// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/data/dashboard
// Returns the unified Global Data Intelligence Cloud™ dashboard bundle.
// Founder & Owner: Prince Singh. Every Data Point. One Enterprise Brain.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { getDataIntelligenceDashboard } from '@/lib/data-intelligence';

export async function GET(_request: NextRequest) {
  try {
    const dashboard = await getDataIntelligenceDashboard();
    return NextResponse.json({ ok: true, dashboard });
  } catch (err) {
    console.error('[data-intelligence/dashboard] Error:', err);
    const message =
      err instanceof Error ? err.message : 'Failed to load data intelligence dashboard';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
