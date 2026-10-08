// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Billing™ — Complete Payment API
// POST /api/billing/payment/complete
//   Body: { organizationId, orderId, paymentId, signature? }
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { BillingError, friendlyBillingError } from '@/lib/billing-provider/errors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { organizationId, orderId, paymentId, signature } = body as {
      organizationId?: string;
      orderId?: string;
      paymentId?: string;
      signature?: string;
    };

    if (!organizationId) return NextResponse.json({ ok: false, error: 'organizationId is required.' }, { status: 400 });
    if (!orderId) return NextResponse.json({ ok: false, error: 'orderId is required.' }, { status: 400 });
    if (!paymentId) return NextResponse.json({ ok: false, error: 'paymentId is required.' }, { status: 400 });

    const { completePayment } = await import('@/lib/billing-provider/server/orchestrator');
    const result = await completePayment(organizationId, orderId, paymentId, signature);
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    const statusCode = err instanceof BillingError ? err.statusCode : 500;
    const code = err instanceof BillingError ? err.code : 'UNKNOWN';
    console.error('[api/billing/payment/complete] error:', code, friendlyBillingError(err));
    return NextResponse.json({ ok: false, error: friendlyBillingError(err), code }, { status: statusCode });
  }
}
