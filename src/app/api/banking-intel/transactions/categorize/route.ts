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

// POST /api/banking-intel/transactions/categorize
// Body: { orgId?, transactionId, category }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const orgId = body.orgId || 'preview-org';
    const { transactionId, category } = body ?? {};

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

    const service = await getBankingService();
    const transaction = await service.categorize(
      orgId,
      transactionId,
      category as TransactionCategory,
    );
    return NextResponse.json({ ok: true, transaction });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    console.error('[banking-intel/transactions/categorize POST]', msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
