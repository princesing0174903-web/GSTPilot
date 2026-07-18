// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — Recommendations API
// GET /api/recommendations?organizationId=...
//
// Returns REAL recommendations generated from the Business Snapshot + Prisma
// enrichment. Always 200 (even for local- orgs — returns []).
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { generateRecommendations } from '@/lib/recommendations/engine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const organizationId = (searchParams.get('organizationId') ?? '').trim();

    if (!organizationId) {
      return NextResponse.json({
        recommendations: [],
        generatedAt: new Date().toISOString(),
      });
    }

    const recommendations = await generateRecommendations(organizationId);
    return NextResponse.json({
      recommendations,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error(
      '[/api/recommendations] error:',
      error instanceof Error ? error.message : error,
    );
    // Never 500 — return empty so the dashboard widget doesn't crash.
    return NextResponse.json({
      recommendations: [],
      generatedAt: new Date().toISOString(),
    });
  }
}
