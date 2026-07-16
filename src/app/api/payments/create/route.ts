import { NextResponse } from 'next/server';
import { createPayment } from '@/lib/gstpilot-data';
import type { CreatePaymentInput } from '@/lib/gstpilot-data';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (body.amount == null) {
      return NextResponse.json({ error: 'amount is required' }, { status: 400 });
    }
    // ORG-SCOPED: the client must send the active organizationId so we write
    // to organizations/{organizationId}/payments — not a hardcoded path.
    const organizationId =
      typeof body.organizationId === 'string' ? body.organizationId : null;
    const input: CreatePaymentInput = {
      partyType: body.partyType ?? 'customer',
      partyId: body.partyId ?? null,
      partyName: body.partyName ?? '',
      invoiceId: body.invoiceId ?? null,
      invoiceNumber: body.invoiceNumber ?? null,
      amount: Number(body.amount),
      paymentDate: body.paymentDate,
      paymentMode: body.paymentMode,
      referenceNo: body.referenceNo ?? null,
      status: body.status,
      reconciled: body.reconciled,
      notes: body.notes ?? null,
    };
    const payment = await createPayment(organizationId, input);
    const direction = payment.partyType === 'customer' ? 'received' : 'paid out';
    return NextResponse.json({
      success: true,
      payment,
      message: `I've recorded the payment of ₹${payment.amount} via ${payment.paymentMode} — ${direction}.`,
    });
  } catch (err) {
    console.error('[API /payments/create] error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to record payment' },
      { status: 500 },
    );
  }
}
