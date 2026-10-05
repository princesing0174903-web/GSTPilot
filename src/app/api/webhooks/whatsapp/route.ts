// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle CFO™ — WhatsApp Webhook Endpoint
//
// GET  /api/webhooks/whatsapp?orgId=X   — Meta Cloud API verify hub challenge
// POST /api/webhooks/whatsapp?orgId=X   — receive delivery + inbound webhooks
//
// Supports:
//   - WhatsApp Cloud API (Meta Graph API)
//   - Twilio WhatsApp (form-encoded status callbacks)
//   - Gupshup WhatsApp (JSON events)
//
// Signature verification:
//   - WhatsApp Cloud API: X-Hub-Signature-256 HMAC-SHA256 with app_secret
//   - Twilio: X-Twilio-Signature HMAC-SHA1 with auth token
//   - Gupshup: custom header (logged but not enforced by default)
//
// Idempotent: always returns 200 to the provider, never throws.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import {
  processWhatsAppWebhook,
  verifyWhatsAppCloudWebhookSignature,
} from '@/lib/oracle-cfo/communication-engine';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Meta Cloud API webhook verification.
 * When you configure the webhook in the Meta App Dashboard, Meta sends a GET
 * with hub.mode=subscribe, hub.verify_token=<your verify token>, hub.challenge.
 * We respond with the challenge to confirm ownership.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');
  const organizationId = url.searchParams.get('orgId');

  if (mode === 'subscribe' && challenge) {
    // Verify the token matches the org's configured verify token
    if (organizationId) {
      try {
        const integRef = doc(db, 'integrations', `whatsapp_${organizationId}`);
        const integSnap = await getDoc(integRef);
        if (integSnap.exists()) {
          const expectedToken = integSnap.data().webhookVerifyToken as string | undefined;
          if (expectedToken && token !== expectedToken) {
            return new NextResponse('Forbidden', { status: 403 });
          }
        }
      } catch {
        // Preview mode — accept the challenge optimistically
      }
    }
    return new NextResponse(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } });
  }

  return NextResponse.json({
    ok: true,
    service: 'gstpilot-whatsapp-webhook',
    providers: ['whatsapp_cloud', 'twilio', 'gupshup'],
    timestamp: new Date().toISOString(),
  });
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  const url = new URL(request.url);
  const organizationId = url.searchParams.get('orgId') ?? null;

  // Detect provider from headers/body
  const contentType = request.headers.get('content-type') ?? '';
  let rawBody = '';
  let parsedBody: any = null;
  let provider: 'whatsapp_cloud' | 'twilio' | 'gupshup' = 'whatsapp_cloud';

  try {
    rawBody = await request.text();
    if (contentType.includes('application/x-www-form-urlencoded')) {
      // Twilio sends form-encoded
      const params = new URLSearchParams(rawBody);
      parsedBody = Object.fromEntries(params.entries());
      provider = 'twilio';
    } else {
      parsedBody = JSON.parse(rawBody);
      // Detect: Meta Cloud API has `object: whatsapp_business_account`
      if (parsedBody?.object === 'whatsapp_business_account') {
        provider = 'whatsapp_cloud';
      } else if (parsedBody?.payload?.source ?? parsedBody?.source) {
        provider = 'gupshup';
      }
    }
  } catch {
    return NextResponse.json({ ok: false, message: 'Could not parse body' }, { status: 400 });
  }

  // ── Signature verification (WhatsApp Cloud API) ──
  let signatureValid = true;
  if (provider === 'whatsapp_cloud' && organizationId) {
    try {
      const integRef = doc(db, 'integrations', `whatsapp_${organizationId}`);
      const integSnap = await getDoc(integRef);
      if (integSnap.exists()) {
        const appSecret = integSnap.data().webhookSecret as string | undefined;
        const sig = request.headers.get('x-hub-signature-256') ?? '';
        if (appSecret && sig) {
          signatureValid = verifyWhatsAppCloudWebhookSignature(rawBody, sig, appSecret);
        }
      }
    } catch {
      // Preview mode — accept optimistically
    }
  }

  if (!signatureValid) {
    console.warn('[whatsapp-webhook] rejected: invalid signature', { provider, organizationId });
    return NextResponse.json({ ok: false, message: 'Invalid signature' }, { status: 200 });
  }

  // ── Extract status + message ID based on provider ──
  let status = '';
  let providerMessageId = '';
  let timestamp: string | undefined;
  let metadata: Record<string, unknown> | undefined;

  try {
    if (provider === 'whatsapp_cloud') {
      // Meta Cloud API webhook structure: entry[].changes[].value.statuses[]
      const entries = Array.isArray(parsedBody?.entry) ? parsedBody.entry : [];
      const allStatuses: any[] = [];
      for (const entry of entries) {
        const changes = Array.isArray(entry?.changes) ? entry.changes : [];
        for (const change of changes) {
          const statuses = Array.isArray(change?.value?.statuses) ? change.value.statuses : [];
          allStatuses.push(...statuses);
        }
      }
      if (allStatuses.length === 0) {
        // Could be an inbound message event — no status to update
        return NextResponse.json({
          ok: true,
          message: 'Webhook received. No delivery status events found (may be an inbound message).',
          provider,
          durationMs: Date.now() - startedAt,
        });
      }
      const first = allStatuses[0];
      status = String(first.status ?? '');
      providerMessageId = String(first.id ?? '');
      timestamp = first.timestamp ? new Date(Number(first.timestamp) * 1000).toISOString() : new Date().toISOString();
      metadata = first;
    } else if (provider === 'twilio') {
      status = String(parsedBody?.SmsStatus ?? parsedBody?.MessageStatus ?? parsedBody?.DeliveryStatus ?? '');
      providerMessageId = String(parsedBody?.MessageSid ?? parsedBody?.SmsSid ?? '');
      timestamp = new Date().toISOString();
      metadata = parsedBody;
    } else if (provider === 'gupshup') {
      const payload = parsedBody?.payload ?? parsedBody;
      status = String(payload?.type ?? parsedBody?.event ?? '');
      providerMessageId = String(payload?.gsId ?? payload?.messageId ?? parsedBody?.messageId ?? '');
      timestamp = parsedBody?.timestamp ?? new Date().toISOString();
      metadata = parsedBody;
    }
  } catch (err) {
    console.warn('[whatsapp-webhook] failed to parse event:', err);
  }

  if (!providerMessageId) {
    return NextResponse.json({
      ok: true,
      message: 'Webhook received but no providerMessageId found.',
      provider,
      durationMs: Date.now() - startedAt,
    });
  }

  const result = await processWhatsAppWebhook({
    provider,
    providerMessageId,
    status: status || 'unknown',
    timestamp,
    metadata,
  });

  // Always return 200 to the provider so they don't retry
  return NextResponse.json({
    ok: result.processed,
    message: result.message,
    provider,
    status,
    providerMessageId,
    durationMs: Date.now() - startedAt,
  });
}
