// GET /api/command/dashboard
// Returns the unified Enterprise Command Network™ (Global Command Center) dashboard.
// Founder & Owner: Prince Singh. One Command. Every Team. Entire Enterprise.

import { NextRequest, NextResponse } from 'next/server';
import { getCommandDashboard } from '@/lib/command-network';

export async function GET(_request: NextRequest) {
  try {
    const dashboard = await getCommandDashboard();
    return NextResponse.json({ ok: true, dashboard });
  } catch (err) {
    console.error('[command/dashboard] Error:', err);
    const message =
      err instanceof Error ? err.message : 'Failed to load command dashboard';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
