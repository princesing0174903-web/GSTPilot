// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Billing™ — Create Payment Session API
//
// POST /api/billing/create-payment
//   Body: { organizationId, invoiceId }
//   Returns: { ok: true, session: PaymentSessionResult }
//
// Creates a payment session for an existing invoice. The client redirects to
// session.paymentUrl to collect payment, then calls /verify-payment to confirm.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { createPaymentSession } from '@/lib/billing-provider/server/orchestrator';
import { friendlyBillingError } from '@/lib/billing-provider/errors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { organizationId, invoiceId } = body as {
      organizationId?: string;
      invoiceId?: string;
    };

    if (!organizationId) {
      return NextResponse.json({ ok: false, error: 'organizationId is required.' }, { status: 400 });
    }
    if (!invoiceId) {
      return NextResponse.json({ ok: false, error: 'invoiceId is required.' }, { status: 400 });
    }

    const session = await createPaymentSession(organizationId, invoiceId);
    return NextResponse.json({ ok: true, session });
  } catch (err) {
    const { statusCode, code, message } = friendlyBillingError(err);
    console.error('[api/billing/create-payment] error:', code, message);
    return NextResponse.json({ ok: false, error: message, code }, { status: statusCode });
  }
}
