import { NextResponse } from 'next/server';
import { createPayment } from '@/lib/invoices/payments';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (body.amount == null) {
      return NextResponse.json({ error: 'amount is required' }, { status: 400 });
    }
    const payment = await createPayment(body);
    return NextResponse.json({
      success: true,
      payment,
      message: `I've recorded the payment of ${payment.amount} via ${payment.mode} — ${payment.direction}.`,
    });
  } catch (err) {
    console.error('[API /payments/create] error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to record payment' },
      { status: 500 },
    );
  }
}
