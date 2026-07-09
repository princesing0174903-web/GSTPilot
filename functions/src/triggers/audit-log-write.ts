/**
 * audit-log-write — onCall function for writing an audit-log entry
 * server-side. Used by the client when an action that should be audited
 * happens entirely on the client (e.g. UI navigation to "viewed PII report")
 * and there's no Firestore write to attach a trigger to.
 *
 * Validates that the caller is a member of the target org (any role), then
 * writes the entry under /orgs/{orgId}/auditLogs with the caller's UID/email
 * stamped from the auth context (cannot be forged from the client).
 */
import { onCall } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import { adminDb, adminAuth } from '../admin';
import { requireOrgRole, PermissionError } from '../helpers/org-permission';
import type { AuditLogEntry } from '../types';

interface AuditLogInput {
  orgId: string;
  action: string;
  targetType: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
}

export const auditLogWrite = onCall(
  { region: 'asia-south1', memory: '128MiB', timeoutSeconds: 15 },
  async (req) => {
    const callerUid = req.auth?.uid;
    const input = (req.data ?? {}) as AuditLogInput;

    if (!input.orgId || !input.action || !input.targetType) {
      return { ok: false, error: { code: 'INVALID_ARGUMENT', message: 'orgId, action, targetType required.' } };
    }

    try {
      await requireOrgRole(adminDb, callerUid, input.orgId);
    } catch (err) {
      if (err instanceof PermissionError) {
        return { ok: false, error: { code: err.code, message: err.message } };
      }
      throw err;
    }

    let actorEmail: string | null = null;
    try {
      if (callerUid) {
        const u = await adminAuth.getUser(callerUid);
        actorEmail = u.email ?? null;
      }
    } catch (err) {
      logger.warn('auditLogWrite: could not resolve caller email', err);
    }

    const now = Date.now();
    const entry: AuditLogEntry = {
      orgId: input.orgId,
      actorUid: callerUid ?? null,
      actorEmail,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      metadata: input.metadata,
      timestamp: now,
    };

    try {
      const ref = await adminDb.collection(`orgs/${input.orgId}/auditLogs`).add(entry);
      logger.info(
        `auditLogWrite: org=${input.orgId} action=${input.action} caller=${callerUid} logId=${ref.id}`,
      );
      return { ok: true, data: { logId: ref.id, timestamp: now } };
    } catch (err) {
      logger.error('auditLogWrite failed', err);
      return {
        ok: false,
        error: { code: 'AUDIT_WRITE_FAILED', message: err instanceof Error ? err.message : 'Unknown error' },
      };
    }
  },
);
