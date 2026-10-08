// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Billing™ — Initiate Payment API
// POST /api/billing/payment
//   Body: InitiatePaymentInput
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { BillingError, friendlyBillingError } from '@/lib/billing-provider/errors';
import type { InitiatePaymentInput } from '@/lib/billing-provider/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as InitiatePaymentInput;

    if (!body.organizationId) return NextResponse.json({ ok: false, error: 'organizationId is required.' }, { status: 400 });
    if (!body.subscriptionId) return NextResponse.json({ ok: false, error: 'subscriptionId is required.' }, { status: 400 });
    if (!body.invoiceId) return NextResponse.json({ ok: false, error: 'invoiceId is required.' }, { status: 400 });
    if (!body.amount || body.amount <= 0) return NextResponse.json({ ok: false, error: 'amount must be greater than 0.' }, { status: 400 });
    if (!body.returnUrl) return NextResponse.json({ ok: false, error: 'returnUrl is required.' }, { status: 400 });

    const { initiatePayment } = await import('@/lib/billing-provider/server/orchestrator');
    const result = await initiatePayment(body);
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    const statusCode = err instanceof BillingError ? err.statusCode : 500;
    const code = err instanceof BillingError ? err.code : 'UNKNOWN';
    console.error('[api/billing/payment] error:', code, friendlyBillingError(err));
    return NextResponse.json({ ok: false, error: friendlyBillingError(err), code }, { status: statusCode });
  }
}
