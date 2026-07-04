import { NextResponse } from 'next/server';
import { createPaymentRequest } from '@/lib/banking/upi';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body.upiId || !body.amount) {
      return NextResponse.json({ error: 'upiId and amount are required' }, { status: 400 });
    }
    const req_ = await createPaymentRequest({
      upiId: body.upiId,
      payerName: body.payerName || 'Customer',
      amount: parseFloat(body.amount),
      note: body.note,
    });
    return NextResponse.json({
      success: true,
      request: req_,
      message: `I've created a UPI payment request for ₹${parseFloat(body.amount).toLocaleString('en-IN')} to ${body.upiId}.`,
    });
  } catch (err) {
    console.error('[API /upi/payment-request] error:', err);
    return NextResponse.json({ error: 'Failed to create payment request' }, { status: 500 });
  }
}
