import { NextResponse } from 'next/server';
import { payPurchaseBill } from '@/lib/invoices/purchases';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json() as { id: string; amount: number; mode?: 'upi' | 'bank' | 'rtgs' | 'neft' | 'imps'; referenceNo?: string };
    if (!body.id || body.amount == null) {
      return NextResponse.json({ error: 'id and amount are required' }, { status: 400 });
    }
    const bill = await payPurchaseBill(body.id, body.amount, body.mode ?? 'bank', body.referenceNo);
    return NextResponse.json({
      success: true,
      bill,
      message: `I've paid ${body.amount} for bill ${bill.billNo} via ${body.mode ?? 'bank'} — ${bill.paymentStatus}.`,
    });
  } catch (err) {
    console.error('[API /purchases/pay] error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to pay purchase bill' },
      { status: 500 },
    );
  }
}
