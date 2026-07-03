// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT ENTERPRISE CLOUD PLATFORM™ — DASHBOARD API
// GET /api/platform/dashboard
//
// Returns the full PlatformDashboard: 14 subsystems, headline KPIs, top orgs,
// identity, subscriptions, billing, marketplace, APIs, devops, monitoring,
// customer success, security, performance. Cached 45s in-memory.
//
// Everything flows from REAL connected business data. No mock values.
// Tagline: Build Once. Deploy Globally. Scale Infinitely.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { getPlatformDashboard } from '@/lib/platform/orchestrator';
import { PLATFORM_TAGLINE } from '@/lib/platform/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

let lastGeneratedAt: string | null = null;

export async function GET() {
  try {
    const dashboard = await getPlatformDashboard();
    const cacheStatus = lastGeneratedAt === dashboard.generatedAt ? 'HIT' : 'MISS';
    lastGeneratedAt = dashboard.generatedAt;

    return NextResponse.json(dashboard, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
        'X-Platform': 'true',
        'X-Platform-Cache': cacheStatus,
        'X-Platform-Live-Data': dashboard.hasLiveData ? 'true' : 'false',
        'X-Platform-Subsystems': `${dashboard.subsystemsImplemented}/${dashboard.subsystemsTotal}`,
        'X-Platform-Sources': dashboard.dataSources.join(','),
      },
    });
  } catch (error) {
    console.error('[Platform Dashboard] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to compute Enterprise Cloud Platform dashboard',
        message: error instanceof Error ? error.message : 'Unknown error',
        tagline: PLATFORM_TAGLINE,
      },
      { status: 500, headers: { 'Cache-Control': 'no-store, max-age=0', 'X-Platform': 'true' } },
    );
  }
}
