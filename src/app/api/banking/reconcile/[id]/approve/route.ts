// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Banking Module™ — Approve Reconciliation API (TASK 12)
//
// POST /api/banking/reconcile/:id/approve?organizationId=...
//   → approveReconciliation(id, orgId, uid)
//
// Marks the reconciliation as 'approved', sets the linked transaction's status
// to 'reconciled' (final state), and writes an audit log entry.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireOrgMembership, friendlyApiError } from '@/lib/auth/session';
import { approveReconciliation } from '@/lib/banking-prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAuth(req);
    if (auth instanceof NextResponse) return auth;
    const { uid } = auth;
    const url = new URL(req.url);
    const orgId = url.searchParams.get('organizationId') || 'local';
    const org = await requireOrgMembership(uid, orgId);
    if (org instanceof NextResponse) return org;

    const { id } = await params;
    const record = await approveReconciliation(id, orgId, uid);
    if (!record) {
      return NextResponse.json(
        { error: 'Reconciliation record not found.' },
        { status: 404 },
      );
    }
    return NextResponse.json({ success: true, record });
  } catch (err) {
    return friendlyApiError(err, 'Failed to approve reconciliation.');
  }
}
