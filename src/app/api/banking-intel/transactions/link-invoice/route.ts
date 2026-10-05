import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth, requireOrgMembership } from '@/lib/auth/session';
import { invalidateBusinessSnapshotCache } from '@/lib/business/snapshot';
import { toTransactionDTO } from '@/lib/banking-prisma/service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST /api/banking-intel/transactions/link-invoice
// Body: { organizationId, transactionId, invoiceId, matchType? }
// Tenant-scoped via requireOrgMembership. Persists the link to canonical
// Prisma BankTransaction.matchedInvoiceId + matched=true (Phase 2 fix —
// previously the in-memory mock provider was updated, so manual links were
// lost on page reload).
export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAuth(req);
    if (authResult instanceof NextResponse) return authResult;
    const { uid } = authResult;

    const body = await req.json().catch(() => ({}));
    const { organizationId, transactionId, invoiceId, matchType } = body ?? {};

    const orgResult = await requireOrgMembership(uid, organizationId);
    if (orgResult instanceof NextResponse) return orgResult;

    if (!transactionId || !invoiceId) {
      return NextResponse.json(
        { ok: false, error: 'transactionId and invoiceId are required' },
        { status: 400 },
      );
    }

    const allowed = ['manual', 'exact', 'fuzzy'];
    const mt =
      typeof matchType === 'string' && allowed.includes(matchType)
        ? matchType
        : 'manual';

    // SECURITY: scope the update by both id AND organizationId.
    const result = await db.bankTransaction.updateMany({
      where: { id: transactionId, organizationId },
      data: {
        matchedInvoiceId: invoiceId,
        matched: true,
        matchType: mt,
        reconciledAt: new Date(),
        reconciledBy: uid,
      },
    });
    if (result.count === 0) {
      return NextResponse.json(
        { ok: false, error: 'Transaction not found' },
        { status: 404 },
      );
    }

    const updated = await db.bankTransaction.findUnique({
      where: { id: transactionId },
      include: { account: { select: { bankName: true, accountMasked: true } } },
    });
    if (!updated) {
      return NextResponse.json(
        { ok: false, error: 'Transaction not found after update' },
        { status: 404 },
      );
    }

    // Invoice linkage affects cash flow + reconciliation views.
    invalidateBusinessSnapshotCache(organizationId);

    return NextResponse.json({ ok: true, transaction: toTransactionDTO(updated) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    console.error('[banking-intel/transactions/link-invoice POST]', msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
