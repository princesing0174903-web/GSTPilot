// GET /api/ecosystem/dashboard
// Full Enterprise AI Platform™ (Ecosystem Edition) dashboard. 12 subsystems,
// headline KPIs, all derived from REAL connected data. Cached 45s in-memory.

import { NextResponse } from 'next/server';
import { getEcosystemDashboard } from '@/lib/ecosystem/orchestrator';
import { ECOSYSTEM_TAGLINE } from '@/lib/ecosystem/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

let lastGeneratedAt: string | null = null;

export async function GET() {
  try {
    const dashboard = await getEcosystemDashboard();
    const cacheStatus = lastGeneratedAt === dashboard.generatedAt ? 'HIT' : 'MISS';
    lastGeneratedAt = dashboard.generatedAt;

    return NextResponse.json(dashboard, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
        'X-Ecosystem': 'true',
        'X-Ecosystem-Cache': cacheStatus,
        'X-Ecosystem-Live-Data': dashboard.hasLiveData ? 'true' : 'false',
        'X-Ecosystem-Subsystems': `${dashboard.subsystemsImplemented}/${dashboard.subsystemsTotal}`,
      },
    });
  } catch (error) {
    console.error('[Ecosystem Dashboard] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to compute Enterprise AI Platform dashboard',
        message: error instanceof Error ? error.message : 'Unknown error',
        tagline: ECOSYSTEM_TAGLINE,
      },
      { status: 500, headers: { 'Cache-Control': 'no-store, max-age=0', 'X-Ecosystem': 'true' } },
    );
  }
}
