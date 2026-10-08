// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Banking Module™ — Reject Reconciliation API (TASK 12)
//
// POST /api/banking/reconcile/:id/reject?organizationId=...
//   body: { reason: string }
//   → rejectReconciliation(id, orgId, uid, reason)
//
// Marks the reconciliation as 'rejected' with the reason in notes, un-marks the
// linked transaction (back to the unmatched pool), and writes an audit log.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireOrgMembership, friendlyApiError } from '@/lib/auth/session';
import { rejectReconciliation } from '@/lib/banking-prisma';

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
    const body = await req.json();
    const reason = typeof body?.reason === 'string' ? body.reason.trim() : '';

    if (!reason) {
      return NextResponse.json(
        { error: 'A reason is required to reject a reconciliation.' },
        { status: 400 },
      );
    }

    const record = await rejectReconciliation(id, orgId, uid, reason);
    if (!record) {
      return NextResponse.json(
        { error: 'Reconciliation record not found.' },
        { status: 404 },
      );
    }
    return NextResponse.json({ success: true, record });
  } catch (err) {
    return friendlyApiError(err, 'Failed to reject reconciliation.');
  }
}
