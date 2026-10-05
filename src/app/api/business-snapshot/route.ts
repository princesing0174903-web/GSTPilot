// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/business-snapshot
// ═══════════════════════════════════════════════════════════════════════════════
//
// THE single source of truth for all business metrics.
//
// Every page — Home Dashboard, Oracle, AI CFO, Run Business, Autonomous — MUST
// call this endpoint (or import getBusinessSnapshot directly on the server) to
// get: Revenue, Cash, Profit, Customers, Invoices, Receivables, Payables, GST
// Liability, ITC, Health Score, Forecast, Risk Score, Collection Rate, Working
// Capital, Runway, and per-entity Zoho sync counts.
//
// Query params:
//   ?organizationId=<org>   The tenant/org id (required)
//   ?forceRefresh=true      Bypass the 30s cache (call after a sync completes)
//
// Returns the BusinessSnapshot JSON. If no data exists, all values are 0
// (honest empty state — never fabricated).
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireOrgMembership, friendlyApiError } from '@/lib/auth/session';
import { getBusinessSnapshot, emptySnapshot } from '@/lib/business/snapshot';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  // ─── AUTH GUARD (ORACLE-AUTH-GUARDS) ──
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;
  const { uid } = authResult;

  try {
    const { searchParams } = new URL(request.url);
    const organizationId =
      searchParams.get('organizationId') ||
      searchParams.get('firmId') ||
      request.headers.get('x-gstpilot-orgid') ||
      '';

    // Validate org membership (reject cross-tenant spoofing).
    const orgResult = await requireOrgMembership(uid, organizationId);
    if (orgResult instanceof NextResponse) return orgResult;

    // No org scope → empty snapshot (never leak cross-tenant data)
    if (!organizationId) {
      return NextResponse.json(emptySnapshot(''), { status: 200 });
    }

    const forceRefresh = searchParams.get('forceRefresh') === 'true';
    const snapshot = await getBusinessSnapshot(organizationId, { forceRefresh });

    return NextResponse.json(snapshot, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch (error) {
    console.error('GET /api/business-snapshot error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to compute business snapshot',
        ...emptySnapshot(''),
      },
      { status: 500 },
    );
  }
}
