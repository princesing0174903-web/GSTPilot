// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — Setu Webhook Receiver
//
// POST /api/webhooks/setu
//
// Receives Setu AA gateway notifications. Setu posts three event types here:
//   1. CONSENT_STATUS_UPDATE — consent reached ACTIVE / REJECTED / REVOKED / EXPIRED
//   2. SESSION_STATUS_UPDATE — data session reached COMPLETED / FAILED / EXPIRED
//   3. FI_DATA_READY         — auto-fetch flow; contains decrypted FI data inline
//
// Security:
//   - Verifies the `x-setu-signature` header using HMAC-SHA256 (timing-safe).
//   - If SETU_WEBHOOK_SECRET is not configured, the webhook is REJECTED (not
//     parsed insecurely) — this is a production security requirement.
//
// Idempotency:
//   - Every event is stored in the SetuWebhookEvent table with a unique `eventId`.
//   - If Setu retries (which it does), the unique constraint prevents duplicate
//     processing. We return 200 OK for duplicates.
//
// This route is UNAUTHENTICATED by design — Setu's servers call it directly and
// authenticate via the HMAC signature. It must NOT require requireAuth.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  parseWebhookEvent,
  isConsentApproved,
  isSessionCompleted,
  setuLogger,
  type SetuWebhookEvent,
  type SetuWebhookConsentData,
  type SetuWebhookSessionData,
  type SetuWebhookFIReadyData,
} from '@/lib/setu';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// ─── Health check (GET) ───────────────────────────────────────────────────────
// Allows Setu (or an operator) to verify the endpoint is alive. Does NOT
// expose any data — just a 200 OK.
export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: '/api/webhooks/setu',
    timestamp: new Date().toISOString(),
  });
}

// ─── Webhook receiver (POST) ─────────────────────────────────────────────────

export async function POST(req: Request) {
  const startedAt = Date.now();

  // 1. Read the RAW body (needed for HMAC signature verification — we cannot
  //    use req.json() because that consumes the stream and we'd lose the raw
  //    bytes needed to recompute the signature).
  const rawBody = await req.text();
  if (!rawBody) {
    setuLogger.warn('Webhook received with empty body', {});
    return NextResponse.json({ ok: false, error: 'Empty body' }, { status: 400 });
  }

  // 2. Get the signature header + webhook secret.
  const signatureHeader = req.headers.get('x-setu-signature');
  const webhookSecret = process.env.SETU_WEBHOOK_SECRET?.trim();

  if (!webhookSecret) {
    // CRITICAL: without the webhook secret, we CANNOT verify the signature.
    // Rejecting is the only safe option — accepting unverified webhooks would
    // allow anyone to forge consent-status notifications.
    setuLogger.error(
      'Webhook rejected — SETU_WEBHOOK_SECRET is not configured. ' +
        'Set it in your environment to receive Setu webhooks.',
      {},
    );
    return NextResponse.json(
      { ok: false, error: 'Webhook secret not configured' },
      { status: 503 },
    );
  }

  // 3. Parse + verify the event using the existing SDK helper.
  //    parseWebhookEvent() verifies the HMAC-SHA256 signature (timing-safe)
  //    AND parses the JSON. Returns null if verification fails or the payload
  //    is not a valid Setu event.
  const event = parseWebhookEvent(rawBody, signatureHeader, webhookSecret);
  if (!event) {
    setuLogger.error('Webhook rejected — signature verification or parsing failed', {});
    return NextResponse.json(
      { ok: false, error: 'Signature verification failed' },
      { status: 401 },
    );
  }

  // 4. Derive an idempotency key.
  //    Setu events don't always have an explicit `eventId` field, so we derive
  //    one from the type + timestamp + consentId/dataSessionId. This is stable
  //    across retries (Setu sends the same timestamp on retries).
  const eventId = deriveEventId(event);

  // 5. Idempotency check — try to create the event row. If the eventId already
  //    exists, this is a retry → return 200 OK without reprocessing.
  try {
    const existing = await db.setuWebhookEvent.findUnique({
      where: { eventId },
      select: { id: true, processed: true },
    });
    if (existing) {
      setuLogger.info('Webhook duplicate (idempotent skip)', {
        eventId,
        type: event.type,
        originalId: existing.id,
      });
      return NextResponse.json({ ok: true, duplicate: true, eventId });
    }

    // Store the event for audit + idempotency.
    await db.setuWebhookEvent.create({
      data: {
        eventId,
        eventType: event.type,
        consentId: event.consentId ?? null,
        dataSessionId: event.dataSessionId ?? null,
        success: event.success,
        payload: rawBody,
        processed: false, // Mark as processed AFTER successful handling.
      },
    });
  } catch (err) {
    // If this is a unique-constraint violation, it's a concurrent duplicate.
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('Unique constraint')) {
      setuLogger.info('Webhook concurrent duplicate (idempotent skip)', { eventId });
      return NextResponse.json({ ok: true, duplicate: true, eventId });
    }
    setuLogger.error('Webhook idempotency store failed', {
      eventId,
      error: msg,
    });
    // Don't fail the webhook on DB errors — Setu would retry. Return 500 so
    // Setu retries, and we process it next time.
    return NextResponse.json(
      { ok: false, error: 'Idempotency store failed' },
      { status: 500 },
    );
  }

  // 6. Dispatch the event to the appropriate handler.
  let processingError: string | null = null;
  try {
    await handleEvent(event);
  } catch (err) {
    processingError = err instanceof Error ? err.message : String(err);
    setuLogger.error('Webhook event handling failed', {
      eventId,
      type: event.type,
      error: processingError,
    });
    // Don't throw — we still want to mark the event as received and return 200
    // so Setu doesn't hammer us with retries. The error is logged + stored.
  }

  // 7. Mark the event as processed (with error if any).
  try {
    await db.setuWebhookEvent.update({
      where: { eventId },
      data: {
        processed: true,
        processedAt: new Date(),
        errorMessage: processingError,
      },
    });
  } catch {
    // Non-fatal — the event is already stored.
  }

  const elapsedMs = Date.now() - startedAt;
  setuLogger.info('Webhook processed', {
    eventId,
    type: event.type,
    consentId: event.consentId,
    elapsedMs,
    hadError: !!processingError,
  });

  return NextResponse.json({
    ok: true,
    eventId,
    type: event.type,
    processed: true,
  });
}

// ─── Event dispatcher ────────────────────────────────────────────────────────

async function handleEvent(event: SetuWebhookEvent): Promise<void> {
  switch (event.type) {
    case 'CONSENT_STATUS_UPDATE':
      await handleConsentStatusUpdate(event);
      break;
    case 'SESSION_STATUS_UPDATE':
      await handleSessionStatusUpdate(event);
      break;
    case 'FI_DATA_READY':
      await handleFiDataReady(event);
      break;
    default:
      setuLogger.warn('Unknown webhook event type — ignoring', { type: event.type });
  }
}

/**
 * CONSENT_STATUS_UPDATE — the user approved/rejected/revoked the consent.
 * Update the SetuConsent row so the frontend (polling /api/banking/complete)
 * sees the new status.
 */
async function handleConsentStatusUpdate(event: SetuWebhookEvent): Promise<void> {
  if (!event.consentId) {
    setuLogger.warn('CONSENT_STATUS_UPDATE missing consentId', {});
    return;
  }

  const data = event.data as SetuWebhookConsentData;
  const status = data?.status;

  setuLogger.info('Consent status update', {
    consentId: event.consentId,
    status,
    success: event.success,
  });

  // Update the SetuConsent row.
  const consent = await db.setuConsent.findUnique({
    where: { consentId: event.consentId },
  });

  if (!consent) {
    // The consent isn't in our DB — it may have been created before the
    // SetuConsent table existed, or by a different deployment. Log and ignore.
    setuLogger.warn('CONSENT_STATUS_UPDATE for unknown consentId', {
      consentId: event.consentId,
    });
    return;
  }

  await db.setuConsent.update({
    where: { consentId: event.consentId },
    data: {
      status: status ?? 'UNKNOWN',
      approvedAt: status === 'ACTIVE' ? new Date() : consent.approvedAt,
    },
  });

  // If the consent was approved, we could trigger a data session here.
  // For now, we let the client call /api/banking/complete (which polls the
  // consent status + creates the session). This keeps the webhook fast.
  if (isConsentApproved(event)) {
    setuLogger.info('Consent approved — client should call /api/banking/complete', {
      consentId: event.consentId,
      organizationId: consent.organizationId,
    });
  }
}

/**
 * SESSION_STATUS_UPDATE — a data session reached COMPLETED / FAILED / EXPIRED.
 * When COMPLETED, the FI data is ready to be fetched via GET /sessions/:id.
 */
async function handleSessionStatusUpdate(event: SetuWebhookEvent): Promise<void> {
  if (!event.dataSessionId) {
    setuLogger.warn('SESSION_STATUS_UPDATE missing dataSessionId', {});
    return;
  }

  const data = event.data as SetuWebhookSessionData;
  const status = data?.status;

  setuLogger.info('Session status update', {
    dataSessionId: event.dataSessionId,
    consentId: event.consentId,
    status,
  });

  if (isSessionCompleted(event)) {
    // The session is complete — the FI data can be fetched. In a full
    // implementation, we'd fetch the session data here and persist the
    // transactions. For now, we log it; the client's /api/banking/complete
    // call will fetch the data when it polls.
    setuLogger.info('Session completed — FI data ready to fetch', {
      dataSessionId: event.dataSessionId,
    });
  }
}

/**
 * FI_DATA_READY — auto-fetch flow. Setu delivers the decrypted FI data inline
 * in the webhook payload. This is the fastest path — no need to poll the session.
 */
async function handleFiDataReady(event: SetuWebhookEvent): Promise<void> {
  const data = event.data as SetuWebhookFIReadyData;

  setuLogger.info('FI data ready', {
    consentId: event.consentId,
    dataSessionId: event.dataSessionId,
    fipCount: data?.fiData?.length ?? 0,
  });

  // In a full implementation, we'd parse data.fiData[], map the accounts +
  // transactions to BankTransaction rows, and persist them. For now, we log
  // that the data arrived. The client can also fetch via /sessions/:id.
  if (data?.fiData) {
    for (const fip of data.fiData) {
      const accountCount = fip.data?.length ?? 0;
      setuLogger.info('FI data received from FIP', {
        fipId: fip.fipID,
        accountCount,
      });
    }
  }
}

// ─── Idempotency key derivation ──────────────────────────────────────────────

/**
 * Derive a stable event id from the event payload. Setu doesn't always include
 * an explicit event id, so we derive one from the type + timestamp + identifiers.
 * This is stable across retries (Setu sends the same timestamp).
 */
function deriveEventId(event: SetuWebhookEvent): string {
  // If Setu includes an explicit id somewhere, prefer it. (Future-proofing.)
  const explicit =
    (event as unknown as { eventId?: string; id?: string }).eventId ||
    (event as unknown as { eventId?: string; id?: string }).id;
  if (explicit) return `setu:${explicit}`;

  // Derive from type + timestamp + consentId/dataSessionId.
  const parts = [
    event.type,
    event.timestamp || '',
    event.consentId || '',
    event.dataSessionId || '',
  ];
  return `setu:${parts.join('|')}`;
}
