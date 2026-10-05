// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot AI CFO™ Phase 1 — FINANCIAL INTELLIGENCE API
// GET /api/ai-cfo/intelligence
//
// Returns the complete Phase 1 Financial Intelligence Bundle:
//   • Executive Summary
//   • Real Financial Health Score (0-100, 10 factors with explanations)
//   • Revenue Analytics (monthly/quarterly/yearly/by-client/by-industry/forecast)
//   • Profitability (Gross/Net/Operating/EBITDA/Expense Ratio/Customer/Vendor)
//   • Cash Flow Engine (current/burn/runway/7d/30d/90d/365d/why decreasing)
//   • Working Capital (CA/CL/WC/Ratio/Quick Ratio/Liquidity Risk)
//   • Expense Engine (9 categories + MoM + trends + top vendors)
//   • Collection Engine (late payments/probability/bad debt/recovery strategy)
//   • GST Position (liability/ITC/at-risk/upcoming dues/filing history)
//   • Forecast Engine (6 metrics × 4 horizons with confidence)
//   • Business Risk Engine (10 risks × Low/Medium/High/Critical)
//   • AI CFO Recommendations (with Reason/Impact/Priority/Confidence)
//
// No mock data. No placeholder analytics. Everything from connected business data.
// Tagline: GSTPilot AI CFO™ — Every business deserves a world-class CFO.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { computeFinancialIntelligence } from '@/lib/cfo/phase1/orchestrator';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// In-memory cache (60s) — keyed by organizationId so different tenants never
// see each other's cached bundle. The bundle is expensive to compute and
// changes only when underlying business data changes (which invalidates via
// graph cache already). 60s keeps the dashboard snappy without staleness.
const cachedBundles = new Map<string, { data: Awaited<ReturnType<typeof computeFinancialIntelligence>>; ts: number }>();
const CACHE_TTL_MS = 60_000;

export async function GET(request: Request) {
  try {
    // Extract organizationId from the request (query string or header), with
    // the same fallback chain as /api/business-snapshot. When no orgId is
    // provided, computeFinancialIntelligence returns an empty bundle (never
    // leaks cross-tenant data). See AUDIT-DUP-1 + task DUP-CLEANUP.
    const { searchParams } = new URL(request.url);
    const organizationId =
      searchParams.get('organizationId') ||
      searchParams.get('firmId') ||
      request.headers.get('x-gstpilot-orgid') ||
      '';

    // Return cached bundle if fresh (per-org cache key)
    const cached = organizationId ? cachedBundles.get(organizationId) : null;
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
      return NextResponse.json(cached.data);
    }

    const bundle = await computeFinancialIntelligence(organizationId || undefined);
    if (organizationId) {
      cachedBundles.set(organizationId, { data: bundle, ts: Date.now() });
    }

    return NextResponse.json(bundle, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
        'X-AI-CFO-Phase': '1',
        'X-Data-Sources': bundle.dataSources.join(','),
      },
    });
  } catch (error) {
    console.error('[AI-CFO-Intelligence] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to compute financial intelligence bundle',
        message: error instanceof Error ? error.message : 'Unknown error',
        tagline: 'GSTPilot AI CFO™ — Every business deserves a world-class CFO.',
      },
      { status: 500 },
    );
  }
}
