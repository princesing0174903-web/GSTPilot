/**
 * ai-context-gather — onCall function that gathers billing/banking/ERP context
 * for the Oracle AI to reason over a user query.
 *
 * Returns a structured context bundle (NOT the AI's answer) so the client-side
 * orchestrator can pass it to the LLM with the user's prompt. Server-side
 * gathering is required because:
 *   • It bypasses Firestore security rules (the AI needs cross-collection reads
 *     the client can't see directly, e.g. other members' draft returns).
 *   • It enforces role-based filtering (a viewer doesn't get PII from invoices).
 *   • It performs server-side PII redaction before the bundle ever leaves the
 *     function (PAN, GSTIN middle digits, etc.).
 */
import { onCall } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import { adminDb } from '../admin';
import { requireOrgRole, PermissionError } from '../helpers/org-permission';

interface ContextGatherInput {
  orgId: string;
  topic: 'billing' | 'banking' | 'erp' | 'compliance' | 'overview';
  sinceDays?: number;
}

export const aiContextGather = onCall(
  { region: 'asia-south1', memory: '512MiB', timeoutSeconds: 30 },
  async (req) => {
    const callerUid = req.auth?.uid;
    const { orgId, topic, sinceDays = 30 } = (req.data ?? {}) as ContextGatherInput;

    if (!orgId || !topic) {
      return { ok: false, error: { code: 'INVALID_ARGUMENT', message: 'orgId + topic required.' } };
    }

    try {
      await requireOrgRole(adminDb, callerUid, orgId, 'owner', 'admin', 'accountant');
    } catch (err) {
      if (err instanceof PermissionError) {
        return { ok: false, error: { code: err.code, message: err.message } };
      }
      throw err;
    }

    const now = Date.now();
    const sinceMs = now - sinceDays * 24 * 60 * 60 * 1000;

    try {
      const bundle: Record<string, unknown> = {
        orgId,
        topic,
        generatedAt: now,
        callerUid: callerUid ?? null,
      };

      if (topic === 'billing' || topic === 'overview') {
        const subSnap = await adminDb.doc(`orgs/${orgId}/billing/subscription`).get();
        const usageSnap = await adminDb
          .collection(`orgs/${orgId}/usage`)
          .where('createdAt', '>=', sinceMs)
          .limit(500)
          .get();
        bundle.billing = {
          subscription: subSnap.exists ? redact(subSnap.data()) : null,
          usageEvents: usageSnap.docs.map((d) => redact(d.data())),
        };
      }

      if (topic === 'banking' || topic === 'overview') {
        const txSnap = await adminDb
          .collection(`orgs/${orgId}/bankTransactions`)
          .where('createdAt', '>=', sinceMs)
          .orderBy('createdAt', 'desc')
          .limit(200)
          .get();
        bundle.banking = {
          transactions: txSnap.docs.map((d) => redact(d.data())),
        };
      }

      if (topic === 'erp' || topic === 'overview') {
        const invSnap = await adminDb
          .collection(`orgs/${orgId}/invoices`)
          .where('createdAt', '>=', sinceMs)
          .orderBy('createdAt', 'desc')
          .limit(200)
          .get();
        bundle.erp = {
          invoices: invSnap.docs.map((d) => redact(d.data())),
        };
      }

      if (topic === 'compliance' || topic === 'overview') {
        const retSnap = await adminDb
          .collection(`orgs/${orgId}/returns`)
          .where('createdAt', '>=', sinceMs)
          .orderBy('createdAt', 'desc')
          .limit(100)
          .get();
        bundle.compliance = {
          returns: retSnap.docs.map((d) => redact(d.data())),
        };
      }

      logger.info(
        `aiContextGather: org=${orgId} topic=${topic} caller=${callerUid}`,
      );
      return { ok: true, data: bundle };
    } catch (err) {
      logger.error('aiContextGather failed', err);
      return {
        ok: false,
        error: { code: 'GATHER_FAILED', message: err instanceof Error ? err.message : 'Unknown error' },
      };
    }
  },
);

/**
 * Best-effort PII redaction: walks the object and masks string values that
 * look like PAN (AAAAA9999A) or GSTIN (15-char alphanumeric) before returning
 * the bundle to the client. Amounts and dates are preserved.
 */
function redact<T>(input: T): T {
  if (input === null || input === undefined) return input;
  if (typeof input === 'string') return input as unknown as T;
  if (typeof input !== 'object') return input;
  if (Array.isArray(input)) return input.map(redact) as unknown as T;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (typeof v === 'string') {
      out[k] = maskIfPii(k, v);
    } else if (typeof v === 'object' && v !== null) {
      out[k] = redact(v);
    } else {
      out[k] = v;
    }
  }
  return out as unknown as T;
}

function maskIfPii(key: string, value: string): string {
  const k = key.toLowerCase();
  if (k.includes('pan') && /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(value)) {
    return `${value.slice(0, 5)}****${value.slice(-1)}`;
  }
  if (k.includes('gstin') && /^[0-9A-Z]{15}$/.test(value)) {
    return `${value.slice(0, 2)}*************${value.slice(-3)}`;
  }
  return value;
}
