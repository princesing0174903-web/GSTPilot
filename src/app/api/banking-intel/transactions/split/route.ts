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

interface SplitInput {
  amount: number;
  category: TransactionCategory;
}

// POST /api/banking-intel/transactions/split
// Body: { organizationId, transactionId, splits: [{amount, category}] }
// Tenant-scoped via requireOrgMembership. Persists the split as N new
// BankTransaction rows in Prisma (Phase 2 fix — previously the in-memory
// mock provider was updated, so splits were lost on page reload). The
// original transaction is deleted; new rows inherit a "(split N of M)" suffix
// in their description for clarity.
export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAuth(req);
    if (authResult instanceof NextResponse) return authResult;
    const { uid } = authResult;

    const body = await req.json().catch(() => ({}));
    const { organizationId, transactionId, splits } = body ?? {};

    const orgResult = await requireOrgMembership(uid, organizationId);
    if (orgResult instanceof NextResponse) return orgResult;

    if (!transactionId) {
      return NextResponse.json(
        { ok: false, error: 'transactionId is required' },
        { status: 400 },
      );
    }
    if (!Array.isArray(splits) || splits.length < 2) {
      return NextResponse.json(
        { ok: false, error: 'splits must be an array with at least 2 entries' },
        { status: 400 },
      );
    }

    const cleanSplits: SplitInput[] = [];
    for (const s of splits) {
      if (!s || typeof s.amount !== 'number' || !s.category) {
        return NextResponse.json(
          { ok: false, error: 'Each split needs {amount:number, category:string}' },
          { status: 400 },
        );
      }
      if (!CATEGORIES.includes(s.category as TransactionCategory)) {
        return NextResponse.json(
          { ok: false, error: `Invalid category in splits: ${s.category}` },
          { status: 400 },
        );
      }
      cleanSplits.push({
        amount: s.amount,
        category: s.category as TransactionCategory,
      });
    }

    // SECURITY: scope the original fetch by both id AND organizationId.
    const original = await db.bankTransaction.findFirst({
      where: { id: transactionId, organizationId },
    });
    if (!original) {
      return NextResponse.json(
        { ok: false, error: 'Transaction not found' },
        { status: 404 },
      );
    }

    // Replace the original with N split rows atomically.
    const created: Array<{
      id: string;
      date: Date;
      description: string | null;
      amount: number;
      category: string | null;
      type: string | null;
      counterparty: string | null;
      notes: string | null;
      status: string | null;
      matched: boolean;
      matchedInvoiceId: string | null;
      matchType: string | null;
      matchConfidence: number;
      reconciledAt: Date | null;
      reconciledBy: string | null;
    }> = [];
    await db.$transaction(async (tx) => {
      await tx.bankTransaction.delete({ where: { id: transactionId } });
      for (let i = 0; i < cleanSplits.length; i++) {
        const s = cleanSplits[i];
        const row = await tx.bankTransaction.create({
          data: {
            organizationId,
            accountId: original.accountId,
            date: original.date,
            description: `${original.description ?? ''} (split ${i + 1} of ${cleanSplits.length})`.trim(),
            amount: s.amount,
            type: original.type,
            category: s.category,
            counterparty: original.counterparty,
            notes: original.notes,
            status: original.status,
            matched: original.matched,
            matchedInvoiceId: original.matchedInvoiceId,
            matchType: original.matchType,
            matchConfidence: original.matchConfidence,
            reconciledAt: original.reconciledAt,
            reconciledBy: original.reconciledBy,
            balance: original.balance,
          },
        });
        created.push(row);
      }
    });

    // Fetch the new rows with account join for the response.
    const rows = await db.bankTransaction.findMany({
      where: { id: { in: created.map((r) => r.id) } },
      include: { account: { select: { bankName: true, accountMasked: true } } },
    });

    // Split affects cash flow categorization.
    invalidateBusinessSnapshotCache(organizationId);

    return NextResponse.json({
      ok: true,
      transactions: rows.map((r) => toTransactionDTO(r)),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    console.error('[banking-intel/transactions/split POST]', msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
