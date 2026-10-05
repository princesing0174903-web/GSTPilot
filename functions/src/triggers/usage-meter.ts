/**
 * usage-meter — onCall function for recording a metered usage event
 * (e.g. "1 AI Oracle query", "1 e-invoice generated") on the server.
 *
 * Server-side metering is the source of truth for billing — client-side
 * counters are too easy to spoof. This function:
 *   • Verifies the caller is an active org member
 *   • Validates the event shape (metric type, units)
 *   • Writes a doc to /orgs/{orgId}/usage with server timestamp
 *   • Increments the org's /orgs/{orgId}/billing/usageSummary counters
 *     for the current billing period (idempotent via doc ID).
 */
import { onCall } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '../admin';
import { requireOrgRole, PermissionError } from '../helpers/org-permission';

interface UsageEventInput {
  orgId: string;
  metric: 'ai_query' | 'e_invoice' | 'storage_gb' | 'api_call' | 'document';
  units: number;
  refType?: string;
  refId?: string;
  metadata?: Record<string, unknown>;
}

const VALID_METRICS: UsageEventInput['metric'][] = [
  'ai_query',
  'e_invoice',
  'storage_gb',
  'api_call',
  'document',
];

export const usageMeter = onCall(
  { region: 'asia-south1', memory: '128MiB', timeoutSeconds: 15 },
  async (req) => {
    const callerUid = req.auth?.uid;
    const input = (req.data ?? {}) as UsageEventInput;

    if (!input.orgId || !input.metric) {
      return { ok: false, error: { code: 'INVALID_ARGUMENT', message: 'orgId + metric required.' } };
    }
    if (!VALID_METRICS.includes(input.metric)) {
      return { ok: false, error: { code: 'INVALID_METRIC', message: `metric must be one of: ${VALID_METRICS.join(', ')}` } };
    }
    if (typeof input.units !== 'number' || input.units <= 0 || !Number.isFinite(input.units)) {
      return { ok: false, error: { code: 'INVALID_UNITS', message: 'units must be a positive finite number.' } };
    }

    try {
      await requireOrgRole(adminDb, callerUid, input.orgId);
    } catch (err) {
      if (err instanceof PermissionError) {
        return { ok: false, error: { code: err.code, message: err.message } };
      }
      throw err;
    }

    const now = Date.now();
    const periodKey = periodKeyFor(now); // YYYY-MM

    try {
      const eventRef = adminDb.collection(`orgs/${input.orgId}/usage`).doc();
      const summaryRef = adminDb.doc(`orgs/${input.orgId}/billing/usageSummary`);

      const batch = adminDb.batch();
      batch.set(eventRef, {
        id: eventRef.id,
        orgId: input.orgId,
        metric: input.metric,
        units: input.units,
        periodKey,
        refType: input.refType ?? null,
        refId: input.refId ?? null,
        metadata: input.metadata ?? null,
        actorUid: callerUid ?? null,
        createdAt: now,
        serverTimestamp: FieldValue.serverTimestamp(),
      });
      // Atomic per-period, per-metric counter increment.
      batch.set(
        summaryRef,
        {
          orgId: input.orgId,
          periodKey,
          totals: {
            [input.metric]: FieldValue.increment(input.units),
          },
          updatedAt: now,
        },
        { merge: true },
      );
      await batch.commit();

      logger.info(
        `usageMeter: org=${input.orgId} metric=${input.metric} units=${input.units} caller=${callerUid}`,
      );
      return { ok: true, data: { eventId: eventRef.id, periodKey } };
    } catch (err) {
      logger.error('usageMeter failed', err);
      return {
        ok: false,
        error: { code: 'METER_FAILED', message: err instanceof Error ? err.message : 'Unknown error' },
      };
    }
  },
);

function periodKeyFor(timestampMs: number): string {
  const d = new Date(timestampMs);
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${d.getUTCFullYear()}-${month}`;
}
