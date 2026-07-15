// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/business/snapshot
//
// The SINGLE source of truth for every dashboard metric in GSTPilot.
//
// Returns the canonical BusinessSnapshot object containing:
//   revenue, expenses, profit, cash, bankBalance, invoices, collections,
//   receivables, payables, gst, itc, customers, vendors, healthScore,
//   risks, forecast, runway, notices, updatedAt, hasLiveData
//
// Every page (Home, Oracle, AI CFO, Run Business, Autonomous) MUST read from
// this endpoint. No page should query the database directly for financial data.
//
// Tenant scoping: ?organizationId=X (or ?firmId=X for legacy callers).
// Cache: 30-second in-memory cache (server-side). ?forceRefresh=true bypasses.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { getBusinessSnapshot } from '@/lib/financial-engine';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('organizationId') || searchParams.get('firmId');
    const forceRefresh = searchParams.get('forceRefresh') === 'true';

    if (!tenantId) {
      // No tenant scope → return empty snapshot (not an error)
      const empty = await getBusinessSnapshot(null);
      return NextResponse.json(empty);
    }

    const snapshot = await getBusinessSnapshot(tenantId, { forceRefresh });

    return NextResponse.json(snapshot, {
      headers: {
        'Cache-Control': 'private, no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    // Log the detailed error internally, return a friendly message
    console.error('[/api/business/snapshot] Error computing business snapshot:', error);

    return NextResponse.json(
      {
        error: 'We could not load your business snapshot right now. Please try again.',
        code: 'SNAPSHOT_FAILED',
      },
      { status: 500 },
    );
  }
}
