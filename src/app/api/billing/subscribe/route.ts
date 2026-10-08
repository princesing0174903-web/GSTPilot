// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Billing™ — Subscribe API
//
// POST /api/billing/subscribe
//   Body: { organizationId, planId, billingCycle, couponCode?, createdBy,
//           customerEmail, customerName, customerPhone? }
//   Returns: { ok: true, result: CreateSubscriptionResult }
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { BillingError, friendlyBillingError } from '@/lib/billing-provider/errors';
import type { BillingCycle, SubscriptionPlanId } from '@/lib/billing-provider/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const VALID_PLANS: SubscriptionPlanId[] = ['free', 'starter', 'professional', 'business', 'enterprise'];
const VALID_CYCLES: BillingCycle[] = ['monthly', 'yearly'];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      organizationId,
      planId,
      billingCycle,
      couponCode,
      createdBy,
      customerEmail,
      customerName,
      customerPhone,
    } = body as {
      organizationId?: string;
      planId?: SubscriptionPlanId;
      billingCycle?: BillingCycle;
      couponCode?: string;
      createdBy?: { uid: string; name: string; email: string };
      customerEmail?: string;
      customerName?: string;
      customerPhone?: string;
    };

    if (!organizationId) {
      return NextResponse.json({ ok: false, error: 'organizationId is required.' }, { status: 400 });
    }
    if (!planId || !VALID_PLANS.includes(planId)) {
      return NextResponse.json(
        { ok: false, error: `planId must be one of: ${VALID_PLANS.join(', ')}` },
        { status: 400 },
      );
    }
    if (!billingCycle || !VALID_CYCLES.includes(billingCycle)) {
      return NextResponse.json(
        { ok: false, error: 'billingCycle must be monthly or yearly.' },
        { status: 400 },
      );
    }
    if (!customerEmail || !customerEmail.includes('@')) {
      return NextResponse.json(
        { ok: false, error: 'A valid customerEmail is required.' },
        { status: 400 },
      );
    }
    if (!customerName || customerName.trim().length < 2) {
      return NextResponse.json(
        { ok: false, error: 'customerName must be at least 2 characters.' },
        { status: 400 },
      );
    }

    // Dynamic import — defers the heavy orchestrator compilation.
    const { createSubscription } = await import('@/lib/billing-provider/server/orchestrator');
    const { startBackgroundBilling } = await import('@/lib/billing-provider/server/scheduler');

    const result = await createSubscription({
      organizationId,
      planId,
      billingCycle,
      couponCode: couponCode?.trim() || undefined,
      createdBy: createdBy ?? { uid: '', name: '', email: '' },
      customerEmail: customerEmail.trim(),
      customerName: customerName.trim(),
      customerPhone: customerPhone?.trim() || undefined,
    });

    // Persist the subscription doc.
    const { ...subFields } = result.subscription;
    delete (subFields as { id?: string }).id;
    const subRef = await addDoc(collection(db, 'subscriptions'), {
      ...subFields,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    result.subscription.id = subRef.id;

    // Persist the billing account (linked to subscription).
    const { ...acctFields } = result.billingAccount;
    delete (acctFields as { id?: string }).id;
    acctFields.subscriptionId = subRef.id;
    await addDoc(collection(db, 'billing_accounts'), {
      ...acctFields,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // Persist the first invoice (if paid plan + active).
    if (result.invoice) {
      const { ...invFields } = result.invoice;
      delete (invFields as { id?: string }).id;
      invFields.subscriptionId = subRef.id;
      await addDoc(collection(db, 'billing_invoices'), {
        ...invFields,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    // Persist the payment attempt (if a payment session was initiated).
    if (result.paymentSession) {
      await addDoc(collection(db, 'payment_attempts'), {
        organizationId,
        paymentId: null,
        subscriptionId: subRef.id,
        invoiceId: result.invoice?.id ?? '',
        amount: result.invoice?.amountDue ?? 0,
        provider: result.subscription.paymentProvider,
        status: 'initiated',
        errorCode: null,
        errorMessage: null,
        providerRequestId: result.paymentSession.orderId,
        attemptNumber: 1,
        createdAt: serverTimestamp(),
      });
    }

    startBackgroundBilling();

    return NextResponse.json({ ok: true, result });
  } catch (err) {
    const statusCode = err instanceof BillingError ? err.statusCode : 500;
    const code = err instanceof BillingError ? err.code : 'UNKNOWN';
    console.error('[api/billing/subscribe] error:', code, friendlyBillingError(err));
    return NextResponse.json(
      { ok: false, error: friendlyBillingError(err), code },
      { status: statusCode },
    );
  }
}
