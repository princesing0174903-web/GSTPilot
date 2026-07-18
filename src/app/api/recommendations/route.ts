// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — /api/recommendations
//
// GET /api/recommendations?organizationId=...
//
// Returns REAL recommendations generated from the Business Snapshot + targeted
// Prisma queries. Replaces the generic/mock AI recommendations.
//
// Flow:
//   1. Read the Business Snapshot (single source of truth).
//   2. Run the PURE rules engine on the snapshot.
//   3. Run the ASYNC enrichment queries in parallel:
//        • getOverdueTomorrowInvoices
//        • getRevenueDrop
//        • getCustomerDelays
//        • getTopCustomerConcentration
//   4. Merge all recommendations + sort by priority (then dueInDays).
//   5. Return { recommendations, generatedAt, snapshotAge }.
//
// Always returns 200 — even for local- org IDs (snapshot returns zeros, Prisma
// returns empty arrays, so most rules do not fire — that's the honest behaviour).
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { getBusinessSnapshot } from '@/lib/business/snapshot';
import {
  generateRecommendationsFromSnapshot,
  getOverdueTomorrowInvoices,
  buildOverdueTomorrowRecommendation,
  getRevenueDrop,
  buildRevenueDropRecommendation,
  getCustomerDelays,
  buildCustomerDelayRecommendations,
  getTopCustomerConcentration,
  buildTopCustomerConcentrationRecommendation,
  sortRecommendations,
  type Recommendation,
} from '@/lib/recommendations/engine';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const organizationId = searchParams.get('organizationId');

  if (!organizationId) {
    return NextResponse.json(
      {
        recommendations: [],
        generatedAt: new Date().toISOString(),
        snapshotAge: 'n/a',
        error: 'organizationId query param is required.',
      },
      { status: 200 },
    );
  }

  try {
    // ── Step 1: Read the Business Snapshot (single source of truth) ──
    const snapshotStart = Date.now();
    const snapshot = await getBusinessSnapshot(organizationId);
    const snapshotAgeMs = Date.now() - snapshotStart;
    const snapshotAge =
      snapshotAgeMs < 1000
        ? `${snapshotAgeMs}ms`
        : `${(snapshotAgeMs / 1000).toFixed(1)}s`;

    // ── Step 2: Pure rules engine (sync) ──
    const pureRecs = generateRecommendationsFromSnapshot(snapshot);

    // ── Step 3: Async enrichment queries (parallel) ──
    // Each query is tenant-scoped — `client: { firmId: organizationId }`. For
    // local- org IDs, these return empty arrays / null and the corresponding
    // recommendation does not fire (correct honest behaviour).
    const [
      overdueTomorrow,
      revenueDrop,
      customerDelays,
      topCustomerConcentration,
    ] = await Promise.all([
      getOverdueTomorrowInvoices(organizationId),
      getRevenueDrop(organizationId),
      getCustomerDelays(organizationId),
      getTopCustomerConcentration(organizationId),
    ]);

    // ── Step 4: Merge enrichment results into Recommendation[] ──
    const enrichmentRecs: Recommendation[] = [];

    const overdueTomorrowRec = buildOverdueTomorrowRecommendation(
      organizationId,
      overdueTomorrow,
    );
    if (overdueTomorrowRec) enrichmentRecs.push(overdueTomorrowRec);

    if (revenueDrop) {
      enrichmentRecs.push(
        buildRevenueDropRecommendation(organizationId, revenueDrop),
      );
    }

    enrichmentRecs.push(
      ...buildCustomerDelayRecommendations(organizationId, customerDelays),
    );

    if (topCustomerConcentration) {
      enrichmentRecs.push(
        buildTopCustomerConcentrationRecommendation(
          organizationId,
          topCustomerConcentration,
        ),
      );
    }

    // ── Step 5: Merge + sort by priority (then dueInDays) ──
    const recommendations = sortRecommendations([...pureRecs, ...enrichmentRecs]);

    return NextResponse.json(
      {
        recommendations,
        generatedAt: new Date().toISOString(),
        snapshotAge,
      },
      { status: 200 },
    );
  } catch (err) {
    console.error('[api/recommendations] GET error:', err);
    // Always 200 — the dashboard degrades gracefully to an empty list.
    return NextResponse.json(
      {
        recommendations: [],
        generatedAt: new Date().toISOString(),
        snapshotAge: 'error',
        error: err instanceof Error ? err.message : 'Unknown error',
      },
      { status: 200 },
    );
  }
}
