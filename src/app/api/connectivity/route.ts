// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/connectivity
// Returns the full Connectivity Dashboard — KPIs, installed connectors, health,
// events, logs, sync jobs, marketplace, sync report, security, document
// intelligence, and real data sources. Single shot for the UI.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { getConnectivityDashboard } from '@/lib/connectivity/orchestrator';

export async function GET() {
  try {
    const dashboard = await getConnectivityDashboard();
    return NextResponse.json(dashboard);
  } catch (err) {
    console.error('[Connectivity] Dashboard error:', err);
    return NextResponse.json(
      { error: 'Failed to load connectivity dashboard', detail: String(err) },
      { status: 500 }
    );
  }
}
