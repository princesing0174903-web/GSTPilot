// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Banking Module™ — Available Reports Catalog (TASK 12)
//
// GET /api/banking/reports/available?organizationId=...
//   → listAvailableReports(orgId)
//
// Returns the catalog of report periods (daily/weekly/monthly/quarterly/yearly)
// with their date ranges + a boolean `available` flag indicating whether any
// transactions exist in that period (used by the UI to enable/disable each
// period card).
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireOrgMembership, friendlyApiError } from '@/lib/auth/session';
import { listAvailableReports } from '@/lib/banking-prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (auth instanceof NextResponse) return auth;
    const { uid } = auth;
    const url = new URL(req.url);
    const orgId = url.searchParams.get('organizationId') || 'local';
    const org = await requireOrgMembership(uid, orgId);
    if (org instanceof NextResponse) return org;

    const reports = await listAvailableReports(orgId);
    return NextResponse.json({ reports });
  } catch (err) {
    return friendlyApiError(err, 'Failed to list available reports.');
  }
}
