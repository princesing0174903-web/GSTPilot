// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO AI CFO™ — Payment Link Execute API (the ACT step)
//
// POST /api/oracle/cfo/payment-link/execute
//
// Input:  { intent, organizationId, firmId, userId, userEmail, userRole }
// Output: { success, message, paymentId, providerPaymentId, linkUrl, linkExpiry,
//           status, emailDelivery, whatsappDelivery, recordsAffected, rollbackStatus }
//
// Called after the CA approves the payment link creation. This endpoint:
//   1. Re-validates the invoice (it may have changed since the THINK step)
//   2. Re-detects the connected provider
//   3. Calls the REAL provider API (Razorpay / Stripe) to create the link
//   4. Persists the payment record to Firestore
//   5. Sends via email (if connected + client has email)
//   6. Sends via WhatsApp (if connected + client has phone)
//   7. Writes activity + audit logs
//   8. Rolls back on any failure (deletes partial records)
//
// NEVER fakes a link URL. If the provider is not connected or the API call
// fails, the response clearly explains what happened.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireOrgMembership, friendlyApiError } from '@/lib/auth/session';
import { executePaymentLinkCreation, type PaymentLinkIntent } from '@/lib/oracle-cfo/payment-link-engine';
import { writeCfoAudit } from '@/lib/oracle-cfo/approval';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  // ─── AUTH GUARD (ORACLE-AUTH-GUARDS) ──
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;
  const { uid } = authResult;

  const startedAt = Date.now();
  let body: any = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const intent = body.intent as PaymentLinkIntent | undefined;
  if (!intent) {
    return NextResponse.json({ error: 'intent is required (from the create step)' }, { status: 400 });
  }

  const ctx = {
    organizationId: String(body.organizationId ?? 'preview-org'),
    firmId: body.firmId ? String(body.firmId) : null,
    userId: String(body.userId ?? 'preview-user'),
    userEmail: String(body.userEmail ?? 'preview@veyro.com'),
    userRole: (body.userRole as string) ?? 'manager',
  };

  const orgId0 = String(body.organizationId ?? body.orgId ?? body.firmId ?? '');
  const orgResult = await requireOrgMembership(uid, orgId0);
  if (orgResult instanceof NextResponse) return orgResult;

  try {
    const result = await executePaymentLinkCreation({
      organizationId: ctx.organizationId,
      firmId: ctx.firmId,
      userId: ctx.userId,
      userEmail: ctx.userEmail,
      intent,
    });

    // Audit the execute attempt (success or failure)
    await writeCfoAudit({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      userEmail: ctx.userEmail,
      toolId: 'create-payment-link',
      toolName: 'Create Payment Link',
      category: 'collections',
      action: 'execute',
      status: result.success ? 'success' : 'failed',
      input: {
        invoiceNumber: intent.invoiceNumber,
        amount: intent.amount,
        currency: intent.currency,
        provider: intent.provider,
      },
      recordsAffected: result.recordsAffected,
      decisionCard: {
        success: result.success,
        paymentId: result.paymentId,
        providerPaymentId: result.providerPaymentId,
        linkUrl: result.linkUrl,
        status: result.status,
        rollbackStatus: result.rollbackStatus,
      },
      aiProvider: 'payment-link-engine',
      executionMs: Date.now() - startedAt,
    }).catch(() => {});

    return NextResponse.json({
      ...result,
      durationMs: Date.now() - startedAt,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json(
      {
        success: false,
        message: `Payment link execution failed: ${msg}`,
        paymentId: null,
        providerPaymentId: null,
        linkUrl: null,
        linkExpiry: null,
        status: 'failed',
        emailDelivery: { sent: false, message: 'Execution failed.' },
        whatsappDelivery: { sent: false, message: 'Execution failed.' },
        recordsAffected: [],
        rollbackStatus: 'not-needed',
        error: msg,
        durationMs: Date.now() - startedAt,
      },
      { status: 500 },
    );
  }
}
