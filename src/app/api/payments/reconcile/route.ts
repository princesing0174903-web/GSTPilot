import { NextResponse } from 'next/server';
import { reconcilePayments } from '@/lib/invoices/payments';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const result = await reconcilePayments();
    return NextResponse.json({
      success: true,
      ...result,
      message: `I've reconciled ${result.matched} of ${result.total} payments (${result.matchedAmount} matched to bank transactions).`,
    });
  } catch (err) {
    console.error('[API /payments/reconcile] error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to reconcile payments' },
      { status: 500 },
    );
  }
}
