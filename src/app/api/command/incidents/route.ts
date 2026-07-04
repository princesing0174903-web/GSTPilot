// GET /api/command/incidents
// Returns the Enterprise Incident Center™ — incidents + summary.
// Founder & Owner: Prince Singh.

import { NextRequest, NextResponse } from 'next/server';
import { getIncidents, getIncidentSummary, detectIncidents } from '@/lib/command-network';

export async function GET(_request: NextRequest) {
  try {
    // Detect any new incidents from live signals first
    await detectIncidents().catch(() => undefined);
    const [incidents, summary] = await Promise.all([
      getIncidents(30),
      getIncidentSummary(),
    ]);
    return NextResponse.json({ ok: true, incidents, summary });
  } catch (err) {
    console.error('[command/incidents] Error:', err);
    const message =
      err instanceof Error ? err.message : 'Failed to load incidents';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
