/**
 * billing-webhook — onRequest HTTPS trigger that receives webhook events
 * from Razorpay (and optionally Stripe).
 *
 * Verifies the HMAC signature using the corresponding provider's secret
 * (set via `firebase functions:secrets:set`), then updates the matching
 * payment / subscription doc in Firestore and emits an audit-log entry.
 *
 * Provider is auto-detected from the `X-GSTP-Provider` header (or query
 * param `?provider=`). Defaults to `razorpay`.
 */
import { onRequest } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import { defineSecret } from 'firebase-functions/params';
import { adminDb } from '../admin';
import {
  verifyRazorpaySignature,
  verifyStripeSignature,
} from '../helpers/verify-webhook';
import type { RazorpayWebhookEvent, StripeWebhookEvent } from '../types';

const RAZORPAY_SECRET = defineSecret('RAZORPAY_WEBHOOK_SECRET');
const STRIPE_SECRET = defineSecret('STRIPE_WEBHOOK_SECRET');

export const billingWebhook = onRequest(
  {
    region: 'asia-south1',
    memory: '256MiB',
    timeoutSeconds: 30,
    secrets: [RAZORPAY_SECRET, STRIPE_SECRET],
  },
  async (req, res) => {
    const provider =
      (req.header('X-GSTP-Provider') as string | undefined) ??
      (req.query.provider as string | undefined) ??
      'razorpay';

    const rawBody =
      typeof req.rawBody === 'string'
        ? req.rawBody
        : req.rawBody?.toString('utf8') ?? '';

    let verified = false;
    try {
      if (provider === 'razorpay') {
        verified = verifyRazorpaySignature(
          rawBody,
          req.header('X-Razorpay-Signature'),
          RAZORPAY_SECRET.value(),
        );
      } else if (provider === 'stripe') {
        verified = verifyStripeSignature(
          rawBody,
          req.header('Stripe-Signature'),
          STRIPE_SECRET.value(),
        );
      } else {
        res.status(400).send(`Unknown provider: ${provider}`);
        return;
      }
    } catch (err) {
      logger.error('billingWebhook: verify threw', err);
      res.status(500).send('verification error');
      return;
    }

    if (!verified) {
      logger.warn(`billingWebhook: bad signature (provider=${provider})`);
      res.status(401).send('invalid signature');
      return;
    }

    try {
      const body = JSON.parse(rawBody) as RazorpayWebhookEvent | StripeWebhookEvent;
      await routeEvent(provider, body);
      res.status(200).send('ok');
    } catch (err) {
      logger.error('billingWebhook: handle failed', err);
      res.status(200).send('ok'); // return 200 so the provider doesn't retry indefinitely
    }
  },
);

async function routeEvent(
  provider: string,
  body: RazorpayWebhookEvent | StripeWebhookEvent,
): Promise<void> {
  const now = Date.now();

  if (provider === 'razorpay') {
    const ev = body as RazorpayWebhookEvent;
    const payment = ev.payload?.payment?.entity;
    if (!payment) return;

    const orgId = payment.notes?.orgId;
    if (!orgId) {
      logger.warn('billingWebhook: razorpay payment missing orgId note', ev.event);
      return;
    }

    await adminDb.collection(`orgs/${orgId}/payments`).add({
      providerPaymentId: payment.id,
      providerOrderId: payment.order_id ?? null,
      provider: 'razorpay',
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      method: payment.method ?? null,
      email: payment.email ?? null,
      contact: payment.contact ?? null,
      rawEvent: ev.event,
      receivedAt: now,
      createdAt: now,
    });

    await adminDb.collection(`orgs/${orgId}/auditLogs`).add({
      orgId,
      actorUid: null,
      actorEmail: payment.email ?? null,
      action: `payment.${payment.status}`,
      targetType: 'payment',
      targetId: payment.id,
      metadata: { provider: 'razorpay', amount: payment.amount },
      timestamp: now,
    });
    return;
  }

  if (provider === 'stripe') {
    const ev = body as StripeWebhookEvent;
    const obj = ev.data?.object as { id?: string; customer?: string; metadata?: { orgId?: string } };
    const orgId = obj?.metadata?.orgId;
    if (!orgId) {
      logger.warn('billingWebhook: stripe event missing orgId metadata', ev.type);
      return;
    }
    await adminDb.collection(`orgs/${orgId}/payments`).add({
      providerEventId: ev.id,
      provider: 'stripe',
      type: ev.type,
      objectId: obj?.id ?? null,
      customerId: obj?.customer ?? null,
      receivedAt: now,
      createdAt: now,
    });
    await adminDb.collection(`orgs/${orgId}/auditLogs`).add({
      orgId,
      actorUid: null,
      actorEmail: null,
      action: `stripe.${ev.type}`,
      targetType: 'payment',
      targetId: obj?.id ?? ev.id,
      metadata: { provider: 'stripe' },
      timestamp: now,
    });
  }
}
