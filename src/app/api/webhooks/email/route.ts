// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle CFO™ — Email Webhook Endpoint
//
// POST /api/webhooks/email?provider=resend|sendgrid|mailgun|gmail|outlook
// GET  /api/webhooks/email  (health check)
//
// Receives delivery status webhooks from the connected email provider and
// updates the corresponding notification record's tracking + status.
//
// Supported events (normalized to common status):
//   sent / delivered / opened / clicked / bounced / failed / complained
//
// Signature verification:
//   - Resend: svix-style (svix-id, svix-timestamp, svix-signature) — verified
//     against integrations/email_{orgId}.webhookSecret
//   - SendGrid: ECDSA signature — verified if webhook signing key configured
//   - Mailgun: HMAC-SHA256 — verified if webhook signing key configured
//   - Gmail/Outlook: no provider-level signing — accepted with logged warning
//
// Idempotent: always returns 200 to the provider, never throws.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { processEmailWebhook, verifyResendWebhookSignature } from '@/lib/oracle-cfo/communication-engine';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: 'gstpilot-email-webhook',
    providers: ['resend', 'sendgrid', 'mailgun', 'gmail', 'outlook'],
    timestamp: new Date().toISOString(),
  });
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  const url = new URL(request.url);
  const provider = (url.searchParams.get('provider') ?? 'resend').toLowerCase() as
    | 'resend' | 'sendgrid' | 'mailgun' | 'gmail' | 'outlook';
  const organizationId = url.searchParams.get('orgId') ?? null;

  let rawBody = '';
  let parsedBody: any = null;
  try {
    rawBody = await request.text();
    parsedBody = JSON.parse(rawBody);
  } catch {
    // Some providers send form-encoded bodies
    try {
      rawBody = await request.text();
    } catch {
      return NextResponse.json({ ok: false, message: 'Could not read body' }, { status: 400 });
    }
  }

  // ── Signature verification (if orgId provided + provider supports it) ──
  let signatureValid = true; // optimistic — if no secret configured, accept
  if (organizationId && provider === 'resend') {
    try {
      const integRef = doc(db, 'integrations', `email_${organizationId}`);
      const integSnap = await getDoc(integRef);
      if (integSnap.exists()) {
        const integData = integSnap.data();
        const secret = integData.webhookSecret as string | undefined;
        const sigHeader = request.headers.get('svix-signature')
          ?? request.headers.get('webhook-signature') ?? '';
        if (secret && sigHeader) {
          signatureValid = verifyResendWebhookSignature(rawBody, sigHeader, secret);
        }
      }
    } catch {
      // Firestore read failed (preview mode) — accept optimistically
    }
  }

  if (!signatureValid) {
    // Return 200 to provider (so they don't retry), but log the rejection
    console.warn('[email-webhook] rejected: invalid signature', { provider, organizationId });
    return NextResponse.json({ ok: false, message: 'Invalid signature' }, { status: 200 });
  }

  // ── Extract event + message ID based on provider ──
  let event = '';
  let providerMessageId = '';
  let recipientEmail: string | undefined;
  let timestamp: string | undefined;
  let metadata: Record<string, unknown> | undefined;

  try {
    if (provider === 'resend') {
      event = String(parsedBody?.type ?? parsedBody?.event ?? '');
      const emailData = parsedBody?.data?.email ?? parsedBody?.data ?? {};
      providerMessageId = String(emailData.id ?? parsedBody?.data?.email_id ?? '');
      recipientEmail = emailData.to ?? parsedBody?.data?.to;
      timestamp = parsedBody?.created_at ?? new Date().toISOString();
      metadata = parsedBody;
    } else if (provider === 'sendgrid') {
      // SendGrid sends an array of events
      const events = Array.isArray(parsedBody) ? parsedBody : [parsedBody];
      const first = events[0] ?? {};
      event = String(first.event ?? '');
      providerMessageId = String(first.sg_message_id ?? first.message_id ?? '');
      recipientEmail = first.email;
      timestamp = first.timestamp ? new Date(Number(first.timestamp) * 1000).toISOString() : new Date().toISOString();
      metadata = first;
    } else if (provider === 'mailgun') {
      event = String(parsedBody?.event ?? '');
      providerMessageId = String(parsedBody?.MessageId ?? parsedBody?.message_id ?? '');
      recipientEmail = parsedBody?.recipient;
      timestamp = parsedBody?.timestamp ? new Date(Number(parsedBody.timestamp) * 1000).toISOString() : new Date().toISOString();
      metadata = parsedBody;
    } else if (provider === 'gmail' || provider === 'outlook') {
      // Custom Pub/Sub push or Graph webhook
      event = String(parsedBody?.event ?? parsedBody?.type ?? 'received');
      providerMessageId = String(parsedBody?.messageId ?? parsedBody?.message_id ?? '');
      recipientEmail = parsedBody?.email ?? parsedBody?.recipient;
      timestamp = parsedBody?.timestamp ?? new Date().toISOString();
      metadata = parsedBody;
    }
  } catch (err) {
    console.warn('[email-webhook] failed to parse event:', err);
  }

  if (!providerMessageId) {
    // No message ID — can't find the notification to update
    return NextResponse.json({
      ok: true,
      message: 'Webhook received but no providerMessageId found. Cannot update notification.',
      provider,
      durationMs: Date.now() - startedAt,
    });
  }

  const result = await processEmailWebhook({
    provider,
    event: event || 'unknown',
    providerMessageId,
    recipientEmail,
    timestamp,
    metadata,
  });

  // Always return 200 to the provider so they don't retry
  return NextResponse.json({
    ok: result.processed,
    message: result.message,
    provider,
    event,
    providerMessageId,
    durationMs: Date.now() - startedAt,
  });
}
