// GET /api/network/dashboard
// Returns the full Global Enterprise Network™ dashboard (all 13 subsystems).

import { NextResponse } from 'next/server';
import { getNetworkDashboard } from '@/lib/network/orchestrator';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const dashboard = await getNetworkDashboard();
    return NextResponse.json(dashboard, {
      headers: { 'Cache-Control': 'no-store, max-age=0', 'X-Network': 'true' },
    });
  } catch (error) {
    console.error('[Network dashboard] Error:', error);
    return NextResponse.json(
      { error: 'Failed to load network dashboard', message: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 },
    );
  }
}
