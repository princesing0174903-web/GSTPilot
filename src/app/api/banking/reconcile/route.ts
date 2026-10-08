// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Banking Module™ — Reconciliation API (TASK 12)
//
// GET  /api/banking/reconcile?organizationId=...&matchType=...&status=...&limit=...
//   → { summary: ReconciliationSummary, records: BankReconciliationRecord[] }
//   Calls getReconciliationSummary(orgId) + listReconciliations(orgId, filters) in parallel.
//
// POST /api/banking/reconcile?organizationId=...
//   → runReconciliation(orgId)
//   Returns { summary, matched } — the reconciliation engine's full output.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireOrgMembership, friendlyApiError } from '@/lib/auth/session';
import {
  getReconciliationSummary,
  listReconciliations,
  runReconciliation,
} from '@/lib/banking-prisma';

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

    const sp = url.searchParams;
    const matchType = sp.get('matchType') || undefined;
    const status = sp.get('status') || undefined;
    const limitParam = sp.get('limit');
    const limit = limitParam ? parseInt(limitParam, 10) : undefined;

    const [summary, records] = await Promise.all([
      getReconciliationSummary(orgId),
      listReconciliations(orgId, { matchType, status, limit }),
    ]);

    return NextResponse.json({ summary, records });
  } catch (err) {
    return friendlyApiError(err, 'Failed to load reconciliation data.');
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (auth instanceof NextResponse) return auth;
    const { uid } = auth;
    const url = new URL(req.url);
    const orgId = url.searchParams.get('organizationId') || 'local';
    const org = await requireOrgMembership(uid, orgId);
    if (org instanceof NextResponse) return org;

    const result = await runReconciliation(orgId);
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    return friendlyApiError(err, 'Failed to run reconciliation.');
  }
}
