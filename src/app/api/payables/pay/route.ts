import { NextResponse } from 'next/server';
import { payPayable } from '@/lib/invoices/payables';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json() as {
      id: string;
      amount: number;
      mode?: 'upi' | 'bank' | 'rtgs' | 'neft' | 'imps';
      referenceNo?: string;
    };
    if (!body.id || body.amount == null) {
      return NextResponse.json({ error: 'id and amount are required' }, { status: 400 });
    }
    const payable = await payPayable(body.id, body.amount, body.mode ?? 'bank', body.referenceNo);
    return NextResponse.json({
      success: true,
      payable,
      message: `I've paid ${body.amount} to ${payable.vendorName} via ${body.mode ?? 'bank'} — ${payable.status}.`,
    });
  } catch (err) {
    console.error('[API /payables/pay] error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to pay payable' },
      { status: 500 },
    );
  }
}
