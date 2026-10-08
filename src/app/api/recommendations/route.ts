// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO — Recommendations API
// GET /api/recommendations?organizationId=...
//
// Returns REAL recommendations generated from the Business Snapshot + Prisma
// enrichment. Always 200 (even for local- orgs — returns []).
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { generateRecommendations } from '@/lib/recommendations/engine';
import { requireAuth, requireOrgMembership } from '@/lib/auth/session';
import { swrCache } from '@/lib/cache/swr';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Recommendations are derived from the snapshot (which has its own 30s cache)
// + enrichment queries. A 30s SWR cache here matches the snapshot TTL — at
// worst the user sees 30s + 30s = 60s old recommendations, which is fine for
// a "what should I do next" feed. The 60s auto-refresh in useAIRecommendations
// still gives fresh data on the next tick.
const RECS_CACHE_TTL_MS = 30_000;

export async function GET(req: NextRequest) {
  try {
    // ── 1. AUTHENTICATION ──────────────────────────────────────────────────
    const authResult = await requireAuth(req);
    if (authResult instanceof NextResponse) return authResult;
    const { uid } = authResult;

    const { searchParams } = new URL(req.url);
    const organizationId = (searchParams.get('organizationId') ?? '').trim();
    const forceRefresh = searchParams.get('forceRefresh') === 'true';

    if (!organizationId) {
      return NextResponse.json({
        recommendations: [],
        generatedAt: new Date().toISOString(),
      });
    }

    // ── 2. AUTHORIZATION — verify org membership ────────────────────────────
    const memberResult = await requireOrgMembership(uid, organizationId);
    if (memberResult instanceof NextResponse) return memberResult;

    // ── 3. SWR cache — in-flight dedup ensures concurrent callers
    // (DashboardPage + OracleDailyBrief) share the same Prisma queries. ──
    const recommendations = await swrCache(
      '/api/recommendations',
      organizationId,
      RECS_CACHE_TTL_MS,
      () => generateRecommendations(organizationId),
      { forceRefresh },
    );
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
