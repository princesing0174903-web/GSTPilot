// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Billing™ — Verify Payment API
//
// POST /api/billing/verify-payment
//   Body: { organizationId, sessionId }
//   Returns: { ok: true, verify, payment?, receipt? }
//
// Verifies the status of a payment session with the provider. On success:
//   • Records the payment (status='paid')
//   • Marks the invoice as paid
//   • Generates a receipt
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { verifyPayment } from '@/lib/billing-provider/server/orchestrator';
import { friendlyBillingError } from '@/lib/billing-provider/errors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { organizationId, sessionId } = body as {
      organizationId?: string;
      sessionId?: string;
    };

    if (!organizationId) {
      return NextResponse.json({ ok: false, error: 'organizationId is required.' }, { status: 400 });
    }
    if (!sessionId) {
      return NextResponse.json({ ok: false, error: 'sessionId is required.' }, { status: 400 });
    }

    const result = await verifyPayment(organizationId, sessionId);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const { statusCode, code, message } = friendlyBillingError(err);
    console.error('[api/billing/verify-payment] error:', code, message);
    return NextResponse.json({ ok: false, error: message, code }, { status: statusCode });
  }
}
