// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle CFO™ — Payment Link Create API (the THINK step)
//
// POST /api/oracle/cfo/payment-link/create
//
// Input:  { message, organizationId, firmId, userId, userEmail, userRole }
// Output: { intent, approval, durationMs }
//
// This endpoint:
//   1. Extracts payment link intent from the message (invoice #, amount, provider)
//   2. Looks up the invoice in the REAL database
//   3. Validates the invoice (exists, unpaid, not cancelled, no existing link)
//   4. Detects the connected payment provider (Razorpay / Stripe)
//   5. Builds the full approval summary (customer / invoice / amount / provider / expiry / fees)
//   6. Writes an "analyze" audit entry
//   7. Returns the approval summary for the CA to review
//
// No payment link is created here — that's the /execute endpoint (after approval).
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import {
  extractPaymentLinkIntent,
  buildPaymentLinkApproval,
} from '@/lib/oracle-cfo/payment-link-engine';
import { writeCfoAudit } from '@/lib/oracle-cfo/approval';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  let body: any = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const message: string = body.message || '';
  if (!message || message.trim().length < 3) {
    return NextResponse.json({ error: 'message is required' }, { status: 400 });
  }

  const ctx = {
    organizationId: String(body.organizationId ?? 'preview-org'),
    firmId: body.firmId ? String(body.firmId) : null,
    userId: String(body.userId ?? 'preview-user'),
    userEmail: String(body.userEmail ?? 'preview@gstpilot.in'),
    userRole: (body.userRole as string) ?? 'manager',
  };

  try {
    // ── 1. Extract intent ──
    const intent = extractPaymentLinkIntent(message);

    // ── 2-5. Build full approval summary (lookup + validate + provider detect + fees) ──
    const approval = await buildPaymentLinkApproval(ctx.organizationId, intent);

    // ── 6. Audit ──
    await writeCfoAudit({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      userEmail: ctx.userEmail,
      toolId: 'create-payment-link',
      toolName: 'Create Payment Link',
      category: 'collections',
      action: 'analyze',
      status: approval.canProceed ? 'pending' : 'blocked',
      input: {
        invoiceNumber: intent.invoiceNumber,
        amount: intent.amount,
        currency: intent.currency,
        provider: intent.provider,
      },
      recordsAffected: [],
      decisionCard: {
        canProceed: approval.canProceed,
        blockingReasons: approval.blockingReasons,
        warnings: approval.warnings,
        invoiceFound: Boolean(approval.invoice),
        providerConnected: approval.provider.connected,
        provider: approval.provider.provider,
      },
      aiProvider: 'payment-link-engine',
      executionMs: Date.now() - startedAt,
    }).catch(() => {});

    return NextResponse.json({
      intent,
      approval,
      durationMs: Date.now() - startedAt,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json(
      {
        error: 'Payment link analysis failed. Please try rephrasing your request.',
        detail: msg,
        durationMs: Date.now() - startedAt,
      },
      { status: 500 },
    );
  }
}
