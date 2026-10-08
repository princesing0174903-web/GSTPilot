// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Banking Module™ — Manual Reconciliation Match API (TASK 12)
//
// POST /api/banking/reconcile/manual?organizationId=...
//   body: { transactionId, invoiceId }
//   → manualMatch(transactionId, invoiceId, orgId, uid)
//
// User-forced txn ↔ invoice link. Auto-approved; records a BankReconciliation
// row with matchedBy='manual' + verification scores (name/amount/ref) in notes.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireOrgMembership, friendlyApiError } from '@/lib/auth/session';
import { manualMatch } from '@/lib/banking-prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (auth instanceof NextResponse) return auth;
    const { uid } = auth;
    const url = new URL(req.url);
    const orgId = url.searchParams.get('organizationId') || 'local';
    const org = await requireOrgMembership(uid, orgId);
    if (org instanceof NextResponse) return org;

    const body = await req.json();
    const { transactionId, invoiceId } = body as {
      transactionId?: string;
      invoiceId?: string;
    };

    if (!transactionId || !invoiceId) {
      return NextResponse.json(
        { error: 'transactionId and invoiceId are required.' },
        { status: 400 },
      );
    }

    const record = await manualMatch(transactionId, invoiceId, orgId, uid);
    if (!record) {
      return NextResponse.json(
        { error: 'Transaction or invoice not found in this workspace.' },
        { status: 404 },
      );
    }
    return NextResponse.json({ success: true, record }, { status: 201 });
  } catch (err) {
    return friendlyApiError(err, 'Failed to create manual match.');
  }
}
