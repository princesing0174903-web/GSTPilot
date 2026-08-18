import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth, requireOrgMembership } from '@/lib/auth/session';
import { invalidateBusinessSnapshotCache } from '@/lib/business/snapshot';
import { toTransactionDTO } from '@/lib/banking-prisma/service';
import type { TransactionCategory } from '@/lib/banking-service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const CATEGORIES: TransactionCategory[] = [
  'sales',
  'payment_received',
  'vendor_payment',
  'salary',
  'rent',
  'utilities',
  'tax',
  'fees',
  'refund',
  'transfer',
  'interest',
  'misc',
];

// POST /api/banking-intel/transactions/categorize
// Body: { organizationId, transactionId, category }
// Tenant-scoped via requireOrgMembership. Persists the new category to the
// canonical Prisma BankTransaction.category column (Phase 2 fix — previously
// the in-memory mock provider was updated, so manual overrides were lost on
// page reload). Also invalidates the canonical Business Snapshot cache so
// dashboard/Oracle/reports reflect the re-categorized cash flow.
export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAuth(req);
    if (authResult instanceof NextResponse) return authResult;
    const { uid } = authResult;

    const body = await req.json().catch(() => ({}));
    const { organizationId, transactionId, category } = body ?? {};

    const orgResult = await requireOrgMembership(uid, organizationId);
    if (orgResult instanceof NextResponse) return orgResult;

    if (!transactionId) {
      return NextResponse.json(
        { ok: false, error: 'transactionId is required' },
        { status: 400 },
      );
    }
    if (!category || !CATEGORIES.includes(category as TransactionCategory)) {
      return NextResponse.json(
        { ok: false, error: `Invalid category: ${category}` },
        { status: 400 },
      );
    }

    // SECURITY: updateMany scoped by both id AND organizationId — prevents
    // an authenticated caller in org A from patching a transaction in org B.
    const result = await db.bankTransaction.updateMany({
      where: { id: transactionId, organizationId },
      data: { category },
    });
    if (result.count === 0) {
      return NextResponse.json(
        { ok: false, error: 'Transaction not found' },
        { status: 404 },
      );
    }

    // Re-fetch the updated row for the response.
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

    // Invalidate the canonical snapshot — categorization affects cash flow.
    invalidateBusinessSnapshotCache(organizationId);

    return NextResponse.json({ ok: true, transaction: toTransactionDTO(updated) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    console.error('[banking-intel/transactions/categorize POST]', msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
