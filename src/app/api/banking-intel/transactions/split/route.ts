import { NextRequest, NextResponse } from 'next/server';
import { getBankingService } from '@/lib/banking-service';
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
// Body: { orgId?, transactionId, splits: [{amount, category}] }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const orgId = body.orgId || 'preview-org';
    const { transactionId, splits } = body ?? {};

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

    const service = await getBankingService();
    const transactions = await service.splitTransaction(
      orgId,
      transactionId,
      cleanSplits,
    );
    return NextResponse.json({ ok: true, transactions });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    console.error('[banking-intel/transactions/split POST]', msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
