// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle CFO™ — Unified Audit Logger
//
// Every Oracle CFO operation is audit-logged to the `oracle_audit_logs`
// Firestore collection. This is the SYSTEM OF RECORD for "what did Oracle do,
// when, for whom, with what data, and what was the result."
//
// Uses adminDb() (server-side Admin SDK) so writes succeed even when
// Firestore security rules would block the client SDK. This is correct because
// audit logs must NEVER be silently dropped — they are a compliance requirement.
// ═══════════════════════════════════════════════════════════════════════════════

import { adminDb } from '@/lib/firebase-admin';
import type { CFOAuditLogEntry } from './types';

const AUDIT_COLLECTION = 'oracle_audit_logs';

export interface AuditContext {
  organizationId: string;
  userId: string;
  userEmail: string;
}

/**
 * Write an audit log entry. NEVER throws — audit failures are logged to
 * console but do not block the operation being audited (otherwise a broken
 * audit log would prevent legitimate business operations).
 *
 * Returns the auditId so callers can reference it in their response.
 */
export async function logOracleOperation(
  ctx: AuditContext,
  entry: Omit<CFOAuditLogEntry, 'auditId' | 'timestamp' | 'userId' | 'userEmail' | 'organizationId'>,
): Promise<string> {
  const auditId = `cfo_audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const timestamp = new Date().toISOString();

  const fullEntry: CFOAuditLogEntry = {
    auditId,
    timestamp,
    userId: ctx.userId,
    userEmail: ctx.userEmail,
    organizationId: ctx.organizationId,
    ...entry,
  };

  try {
    await adminDb().collection(AUDIT_COLLECTION).doc(auditId).set(fullEntry);
  } catch (err) {
    // Audit failure must NOT block the operation. Log to stderr for ops review.
    console.error('[oracle-cfo:audit] Failed to write audit log', {
      auditId,
      operationType: entry.operationType,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return auditId;
}

/**
 * Read recent audit log entries for an organization (most recent first).
 * Used by the audit-trail UI and by compliance officers reviewing Oracle's
 * actions.
 */
export async function getRecentAuditLogs(
  organizationId: string,
  limit: number = 25,
): Promise<CFOAuditLogEntry[]> {
  try {
    const snap = await adminDb()
      .collection(AUDIT_COLLECTION)
      .where('organizationId', '==', organizationId)
      .orderBy('timestamp', 'desc')
      .limit(Math.min(limit, 100))
      .get();

    return snap.docs.map((d) => d.data() as CFOAuditLogEntry);
  } catch (err) {
    console.error('[oracle-cfo:audit] Failed to read audit logs', {
      organizationId,
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

/**
 * Update an existing audit log entry (e.g. to record rollback status after
 * a failed action). Used when an action initially succeeds but later needs
 * to be rolled back.
 */
export async function updateAuditEntry(
  auditId: string,
  patch: Partial<CFOAuditLogEntry>,
): Promise<void> {
  try {
    await adminDb().collection(AUDIT_COLLECTION).doc(auditId).set(patch, { merge: true });
  } catch (err) {
    console.error('[oracle-cfo:audit] Failed to update audit entry', {
      auditId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
