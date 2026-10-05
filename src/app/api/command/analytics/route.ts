// GET /api/command/analytics
// Returns the Enterprise Command Analytics™ — 10 command-network KPIs.
// Founder & Owner: Prince Singh.

import { NextRequest, NextResponse } from 'next/server';
import { getCommandAnalytics } from '@/lib/command-network';

export async function GET(_request: NextRequest) {
  try {
    const analytics = await getCommandAnalytics();
    return NextResponse.json({ ok: true, analytics });
  } catch (err) {
    console.error('[command/analytics] Error:', err);
    const message =
      err instanceof Error ? err.message : 'Failed to load command analytics';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
