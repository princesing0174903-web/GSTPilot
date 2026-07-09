// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle CFO™ — Payment Webhook Handler
//
// POST /api/oracle/cfo/payment-link/webhook?provider=razorpay|stripe
//
// Receives webhook events from Razorpay / Stripe and updates the payment
// record + invoice status in real time.
//
// Security:
//   • Verifies the webhook signature using the org's webhook secret
//   • Looks up the payment record by providerPaymentId
//   • Updates status (paid / failed / expired / refunded / cancelled)
//   • If paid → marks the linked invoice as paid + writes a "payment_received" activity
//
// This is a PUBLIC endpoint (called by providers, not the app). It must:
//   • Never throw (always return 200 to the provider to avoid retries)
//   • Verify signatures before processing
//   • Be idempotent (safe to receive the same event multiple times)
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import {
  processPaymentWebhook,
  verifyRazorpayWebhookSignature,
  verifyStripeWebhookSignature,
} from '@/lib/oracle-cfo/payment-link-engine';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  const url = new URL(request.url);
  const provider = (url.searchParams.get('provider') ?? '').toLowerCase();
  const organizationId = url.searchParams.get('orgId') ?? undefined;

  if (provider !== 'razorpay' && provider !== 'stripe') {
    return NextResponse.json(
      { error: 'provider query parameter must be "razorpay" or "stripe"' },
      { status: 400 },
    );
  }

  // Read the raw body (needed for signature verification)
  const rawBody = await request.text();
  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 },
    );
  }

  try {
    // ── Load the org's webhook secret ──
    let webhookSecret = '';
    if (organizationId) {
      try {
        const docRef = doc(db, 'integrations', `${provider}_${organizationId}`);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          webhookSecret = (snap.data().webhookSecret as string) ?? (snap.data().webhook_secret as string) ?? '';
        }
      } catch {
        // ignore — treat as no secret
      }
    }

    // ── Signature verification (if a webhook secret is configured) ──
    if (webhookSecret) {
      const sigHeader = request.headers.get('x-razorpay-signature') ?? request.headers.get('stripe-signature') ?? '';
      const verified = provider === 'razorpay'
        ? verifyRazorpayWebhookSignature(rawBody, sigHeader, webhookSecret)
        : verifyStripeWebhookSignature(rawBody, sigHeader, webhookSecret);

      if (!verified) {
        console.warn(`[payment-webhook] signature verification failed for ${provider} org=${organizationId}`);
        // Return 200 anyway so the provider doesn't retry, but don't process.
        return NextResponse.json(
          { received: true, processed: false, reason: 'signature_verification_failed' },
          { status: 200 },
        );
      }
    }

    // ── Normalize the event into a common shape ──
    let event = '';
    let providerPaymentId = '';
    let status: 'paid' | 'failed' | 'expired' | 'refunded' | 'cancelled' = 'failed';
    let amount: number | undefined;
    let method: string | undefined;

    if (provider === 'razorpay') {
      event = String(payload.event ?? '');
      const paymentEntity = payload.payload?.payment?.entity ?? payload.payload?.payment_link?.entity ?? {};
      providerPaymentId = String(paymentEntity.id ?? payload.payload?.payment_link?.entity?.id ?? '');
      if (event.includes('payment.captured') || event.includes('payment_link.paid')) {
        status = 'paid';
        amount = Number(paymentEntity.amount ?? 0) / 100; // paise → rupees
        method = String(paymentEntity.method ?? '');
      } else if (event.includes('payment.failed')) {
        status = 'failed';
      } else if (event.includes('payment_link.expired')) {
        status = 'expired';
      } else if (event.includes('refund')) {
        status = 'refunded';
      } else if (event.includes('cancelled')) {
        status = 'cancelled';
      }
    } else {
      // Stripe
      event = String(payload.type ?? '');
      const data = payload.data?.object ?? {};
      providerPaymentId = String(data.id ?? '');
      if (event === 'checkout.session.completed' || event === 'payment_intent.succeeded') {
        status = 'paid';
        amount = Number(data.amount_total ?? data.amount_received ?? 0) / 100;
        method = String(data.payment_method_types?.[0] ?? '');
      } else if (event === 'payment_intent.payment_failed' || event === 'checkout.session.async_payment_failed') {
        status = 'failed';
      } else if (event === 'checkout.session.expired') {
        status = 'expired';
      } else if (event.includes('refund')) {
        status = 'refunded';
      } else if (event === 'charge.refunded') {
        status = 'refunded';
      }
    }

    if (!providerPaymentId) {
      return NextResponse.json(
        { received: true, processed: false, reason: 'no_payment_id_in_event', event },
        { status: 200 },
      );
    }

    // ── Process the webhook ──
    const result = await processPaymentWebhook({
      provider: provider as 'razorpay' | 'stripe',
      event,
      paymentId: providerPaymentId,
      status,
      amount,
      method,
      rawPayload: payload,
      organizationId,
    });

    return NextResponse.json(
      {
        received: true,
        processed: result.success,
        updated: result.updated,
        message: result.message,
        event,
        providerPaymentId,
        status,
        durationMs: Date.now() - startedAt,
      },
      { status: 200 },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[payment-webhook] error:', msg);
    // Return 200 to stop provider retries, but flag the failure
    return NextResponse.json(
      {
        received: true,
        processed: false,
        error: msg,
        durationMs: Date.now() - startedAt,
      },
      { status: 200 },
    );
  }
}

// GET endpoint for testing / health check
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const provider = url.searchParams.get('provider');
  return NextResponse.json({
    ok: true,
    message: 'Payment webhook endpoint is live.',
    provider: provider ?? '(not specified)',
    usage: 'POST /api/oracle/cfo/payment-link/webhook?provider=razorpay|stripe&orgId=<orgId>',
  });
}
