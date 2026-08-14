// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — GST Audit Logger (SERVER-ONLY)
// ═══════════════════════════════════════════════════════════════════════════════
//
// Lightweight audit trail for every GST operation. Writes to the existing
// AuditLog table (org-scoped via the `details` JSON since AuditLog uses
// `clientId`, not `organizationId`). Also emits a server-side console log for
// operational debugging.
//
// SECURITY:
//   • NEVER log secrets, tokens, or credentials. The `details` object is
//     sanitized before persistence — only action, entity, outcome, and
//     non-sensitive metadata are recorded.
//   • All logs are server-side only. Nothing is shipped to the client.
//   • The `userId` is the authenticated actor (from requireAuth).
//
// USAGE:
//   await logGSTAudit({
//     organizationId,
//     userId: uid,
//     action: 'gst.connect' | 'gst.test' | 'gst.sync' | 'gst.verify-gstin' | 'gst.disconnect' | 'gst.reconciliation.run',
//     entity: 'GSPProviderConfig' | 'GSTSyncJob' | 'GSTR2BInvoice' | 'GSTReconciliationRun',
//     entityId: '...',
//     details: { provider, ok, mode, recordsFetched, ... },  // NO secrets
//   });
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';

export interface GSTAuditEntry {
  organizationId: string;
  userId: string;
  action:
    | 'gst.connect'
    | 'gst.test'
    | 'gst.sync'
    | 'gst.sync.retry'
    | 'gst.verify-gstin'
    | 'gst.disconnect'
    | 'gst.reconciliation.run'
    | 'gst.reconciliation.resolve'
    | 'gst.reconciliation.auto-fix';
  entity: 'GSPProviderConfig' | 'GSTSyncJob' | 'GSTR2BInvoice' | 'GSTReconciliationRun' | 'GSTReconciliationMatch' | 'GSTProfile';
  entityId: string;
  details?: Record<string, unknown>;
}

// Fields that must NEVER be logged (sanitized to '***REDACTED***').
const REDACTED_KEYS = new Set([
  'clientSecret', 'apikey', 'accessToken', 'refreshToken', 'password',
  'token', 'secret', 'authorization', 'auth', 'session', 'encryptedSession',
]);

function sanitizeDetails(details: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!details) return undefined;
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(details)) {
    if (REDACTED_KEYS.has(key)) {
      sanitized[key] = '***REDACTED***';
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      sanitized[key] = sanitizeDetails(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

/**
 * Write a GST audit log entry. Non-blocking — errors are swallowed (audit
 * logging must NEVER break the main operation). Returns void.
 *
 * NOTE: The `userId` is stored in the `details` JSON (not the `userId` foreign
 * key field) because the AuditLog.userId column has a FK constraint to User,
 * and local-workspace/demo users may not have a User row. This avoids FK
 * violations while preserving the audit trail.
 */
export async function logGSTAudit(entry: GSTAuditEntry): Promise<void> {
  try {
    const sanitized = sanitizeDetails(entry.details);
    await db.auditLog.create({
      data: {
        userId: null, // Avoid FK violation — userId is stored in details JSON.
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId,
        details: JSON.stringify({
          organizationId: entry.organizationId,
          actorUserId: entry.userId,
          ...sanitized,
          timestamp: new Date().toISOString(),
        }),
      },
    });
    // Server-side console log for operational debugging (no secrets).
    console.log(`[gst-audit] ${entry.action} org=${entry.organizationId} entity=${entry.entity} id=${entry.entityId} ok=${sanitized?.ok ?? 'n/a'}`);
  } catch (err) {
    // Audit logging is best-effort — never break the main operation.
    console.error('[gst-audit] Failed to write audit log:', err instanceof Error ? err.message : String(err));
  }
}
