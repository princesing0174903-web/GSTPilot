// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Billing™ — Refund API
// POST /api/billing/refund
//   Body: RefundPaymentInput
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { BillingError, friendlyBillingError } from '@/lib/billing-provider/errors';
import type { RefundPaymentInput } from '@/lib/billing-provider/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as RefundPaymentInput & {
      refundedBy?: { uid: string; name: string; email: string };
    };

    if (!body.organizationId) return NextResponse.json({ ok: false, error: 'organizationId is required.' }, { status: 400 });
    if (!body.paymentId) return NextResponse.json({ ok: false, error: 'paymentId is required.' }, { status: 400 });
    if (!body.amount || body.amount <= 0) return NextResponse.json({ ok: false, error: 'amount must be greater than 0.' }, { status: 400 });
    if (!body.refundedBy) body.refundedBy = { uid: '', name: '', email: '' };

    const { refundPayment } = await import('@/lib/billing-provider/server/orchestrator');
    const result = await refundPayment(body);
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    const statusCode = err instanceof BillingError ? err.statusCode : 500;
    const code = err instanceof BillingError ? err.code : 'UNKNOWN';
    console.error('[api/billing/refund] error:', code, friendlyBillingError(err));
    return NextResponse.json({ ok: false, error: friendlyBillingError(err), code }, { status: statusCode });
  }
}
