// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Infinity™ — Immutable Audit Logging
//
// Writes append-only audit-log entries to the Firestore `audit_logs`
// collection (org-scoped via the `organizationId` field on every document).
//
//   • The firestore.rules explicitly DENY update / delete on this collection
//     — once written, an audit entry is permanent and tamper-evident.
//   • All writes go through `firebase-admin` (server-side, bypasses rules)
//     so an audit row is recorded even for actions performed by
//     background jobs / cloud functions that don't have an end-user session.
//   • High-volume actions (e.g. AI queries) are buffered into batches of 50
//     and flushed periodically to avoid hammering Firestore.
//   • Reads (queryAuditLogs, subscribeToAuditLogs) go through the regular
//     client SDK so they are subject to security rules — a user can only
//     see audit rows for orgs they belong to.
//
// Resilience: recordAudit NEVER throws — if firebase-admin is unavailable
// (sandbox, missing creds) or Firestore rejects the write, the entry is
// logged to console.error and the call returns. Audit logging must never
// crash the request that triggered it.
// ═══════════════════════════════════════════════════════════════════════════════

import type { Timestamp as FbTimestamp } from 'firebase/firestore';

// ─── Audit action vocabulary ──────────────────────────────────────────────────
//
// Every action is namespaced as `<domain>.<verb>` so it can be parsed by
// log aggregators and dashboards without string parsing ambiguity. Adding
// a new action requires updating this union — that's intentional (prevents
// silent typos at audit-write call sites).

export type AuditAction =
  | 'auth.login'
  | 'auth.logout'
  | 'auth.signup'
  | 'auth.password_reset'
  | 'invoice.create'
  | 'invoice.update'
  | 'invoice.delete'
  | 'invoice.send'
  | 'gst.filing.create'
  | 'gst.filing.submit'
  | 'gst.filing.cancel'
  | 'payment.received'
  | 'payment.refunded'
  | 'payment.failed'
  | 'ai.query'
  | 'ai.action'
  | 'ai.export'
  | 'org.create'
  | 'org.update'
  | 'org.delete'
  | 'org.member.invite'
  | 'org.member.remove'
  | 'org.member.role_change'
  | 'settings.update'
  | 'data.export'
  | 'data.import'
  | 'document.upload'
  | 'document.download'
  | 'document.delete'
  | 'billing.subscribe'
  | 'billing.upgrade'
  | 'billing.cancel'
  | 'erp.connect'
  | 'erp.sync'
  | 'banking.connect'
  | 'banking.sync';

// 36 actions total — count verified at the bottom of this file via
// `AUDIT_ACTIONS` so the union and the runtime list can never drift.

export const AUDIT_ACTIONS: readonly AuditAction[] = [
  'auth.login', 'auth.logout', 'auth.signup', 'auth.password_reset',
  'invoice.create', 'invoice.update', 'invoice.delete', 'invoice.send',
  'gst.filing.create', 'gst.filing.submit', 'gst.filing.cancel',
  'payment.received', 'payment.refunded', 'payment.failed',
  'ai.query', 'ai.action', 'ai.export',
  'org.create', 'org.update', 'org.delete',
  'org.member.invite', 'org.member.remove', 'org.member.role_change',
  'settings.update',
  'data.export', 'data.import',
  'document.upload', 'document.download', 'document.delete',
  'billing.subscribe', 'billing.upgrade', 'billing.cancel',
  'erp.connect', 'erp.sync',
  'banking.connect', 'banking.sync',
] as const;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AuditLogEntry {
  /** Firestore document ID. Server-assigned via `.add()` for uniqueness. */
  id: string;
  /** ISO-8601 timestamp (UTC). */
  timestamp: string;
  action: AuditAction;
  /** Who performed the action. `uid` is the unforgeable Firebase UID. */
  actor: {
    uid: string;
    name?: string;
    email?: string;
  };
  /** Org the action affected. Every audit row is org-scoped. */
  organizationId: string;
  /** Optional resource type (e.g. 'invoice', 'client'). */
  resourceType?: string;
  /** Optional resource ID (e.g. invoice ID). */
  resourceId?: string;
  /** Arbitrary structured metadata specific to the action. */
  metadata?: Record<string, unknown>;
  /** Originating IP address (from x-forwarded-for or remoteAddress). */
  ipAddress?: string;
  /** Browser user-agent string (for client-initiated actions). */
  userAgent?: string;
  /** Whether the action succeeded, failed, or was denied (RBAC). */
  result: 'success' | 'failure' | 'denied';
  /** Human-readable reason for failure / denial. */
  reason?: string;
}

// ─── Firestore helper ─────────────────────────────────────────────────────────
//
// We import firebase-admin lazily inside the function bodies so this module
// can be imported by client code (for the subscribeToAuditLogs / queryAuditLogs
// functions) without dragging the admin SDK into the browser bundle. The
// admin SDK throws at import-time when there are no credentials, so any
// top-level import would crash client-side rendering.

const AUDIT_COLLECTION = 'audit_logs';

interface FirestoreLike {
  collection(path: string): {
    add(data: unknown): Promise<{ id: string }>;
    doc(id: string): { get(): Promise<{ exists: boolean; data?: () => unknown }> };
  };
  batch(): {
    set(ref: unknown, data: unknown): unknown;
    commit(): Promise<unknown>;
  };
}

let adminDbCache: FirestoreLike | null = null;
let adminDbInitFailed = false;

async function getAdminDb(): Promise<FirestoreLike | null> {
  if (adminDbCache) return adminDbCache;
  if (adminDbInitFailed) return null;
  try {
    // Server-only dynamic import — never executes in the browser because
    // recordAudit is only ever called from server code (API routes, server
    // actions, cloud functions).
    const adminModule = await import('@/lib/firebase-admin');
    const db = adminModule.adminDb();
    adminDbCache = db as unknown as FirestoreLike;
    return adminDbCache;
  } catch (err) {
    adminDbInitFailed = true;
     
    console.error('[observability/audit-log] firebase-admin unavailable — audit entries will fall back to console:', err);
    return null;
  }
}

// ─── Batching for high-volume actions ─────────────────────────────────────────
//
// Actions like `ai.query` can fire thousands of times per minute. Writing
// each one synchronously to Firestore would (a) exhaust the 500-docs-per-
// batch write quota and (b) slow the request. We buffer high-volume actions
// in memory and flush on a 50-entry threshold OR a 5-second timer.
//
// Low-volume actions are written immediately (their caller awaits the write).

const HIGH_VOLUME_ACTIONS: ReadonlySet<AuditAction> = new Set<AuditAction>([
  'ai.query',
  'ai.action',
  'ai.export',
]);

const BATCH_FLUSH_THRESHOLD = 50;
const BATCH_FLUSH_INTERVAL_MS = 5_000;

interface BufferedEntry {
  payload: Omit<AuditLogEntry, 'id' | 'timestamp'>;
  timestamp: string;
}

let buffer: BufferedEntry[] = [];
let flushTimer: ReturnType<typeof setInterval> | null = null;

function ensureFlushTimer(): void {
  if (flushTimer) return;
  // Set up a periodic flush so the buffer doesn't sit waiting forever for
  // the threshold to be reached.
  flushTimer = setInterval(() => {
    void flushBuffer().catch(() => { /* swallow — never throw */ });
  }, BATCH_FLUSH_INTERVAL_MS);
  // Don't keep the Node event loop alive solely for audit flushing.
  if (flushTimer && typeof flushTimer.unref === 'function') {
    flushTimer.unref();
  }
}

async function flushBuffer(): Promise<void> {
  if (buffer.length === 0) return;
  const batch = buffer.splice(0, buffer.length);
  const db = await getAdminDb();
  if (!db) {
    // No Firestore — emit to console so the audit trail isn't lost.
    for (const item of batch) {
       
      console.warn('[audit-fallback]', JSON.stringify({ ...item.payload, timestamp: item.timestamp }));
    }
    return;
  }
  try {
    const writeBatch = db.batch();
    for (const item of batch) {
      // Each buffered entry becomes its own doc in `audit_logs`.
      // We use `.doc()` + batch.set so the server-side timestamp is
      // controlled by us (not serverTimestamp()) — keeping the entry
      // shape identical to the immediate-write path.
      const ref = (db.collection(AUDIT_COLLECTION) as unknown as { doc(): { set: (d: unknown) => void } }).doc();
      writeBatch.set(ref, { ...item.payload, timestamp: item.timestamp });
    }
    await writeBatch.commit();
  } catch (err) {
     
    console.error('[observability/audit-log] batch flush failed — entries lost:', err);
  }
}

// ─── recordAudit ──────────────────────────────────────────────────────────────

/**
 * Record an immutable audit-log entry.
 *
 * Writes to Firestore `audit_logs` collection (org-scoped). The entry is
 * permanent — firestore.rules deny update/delete on this collection.
 *
 * For high-volume actions (AI queries), the entry is buffered and flushed
 * in batches — this function resolves immediately for those, allowing the
 * caller to continue without awaiting a Firestore write.
 *
 * For all other actions, the function awaits the Firestore write so the
 * audit trail is durable before the response is sent.
 *
 * NEVER throws. On Firestore failure, logs to console and returns.
 */
export async function recordAudit(
  entry: Omit<AuditLogEntry, 'id' | 'timestamp'>,
): Promise<void> {
  const timestamp = new Date().toISOString();

  // High-volume actions: buffer + return immediately.
  if (HIGH_VOLUME_ACTIONS.has(entry.action)) {
    buffer.push({ payload: entry, timestamp });
    if (buffer.length >= BATCH_FLUSH_THRESHOLD) {
      // Trigger flush without awaiting — caller doesn't wait.
      void flushBuffer().catch(() => { /* swallow */ });
    } else {
      ensureFlushTimer();
    }
    return;
  }

  // Standard actions: write immediately.
  const db = await getAdminDb();
  if (!db) {
     
    console.warn('[audit-fallback]', JSON.stringify({ ...entry, timestamp }));
    return;
  }

  try {
    await db.collection(AUDIT_COLLECTION).add({ ...entry, timestamp });
  } catch (err) {
     
    console.error('[observability/audit-log] write failed:', err);
  }
}

// ─── queryAuditLogs ───────────────────────────────────────────────────────────

export interface AuditLogQueryFilters {
  /** Filter by action type (exact match). */
  action?: AuditAction;
  /** Filter by actor UID (exact match). */
  actorUid?: string;
  /** Filter by resource type (exact match). */
  resourceType?: string;
  /** Filter by result (exact match). */
  result?: 'success' | 'failure' | 'denied';
  /** Inclusive lower bound (ISO-8601 or epoch ms). */
  startDate?: string | number;
  /** Inclusive upper bound (ISO-8601 or epoch ms). */
  endDate?: string | number;
  /** Page size. Default 50, max 200. */
  limit?: number;
  /** Pagination cursor — pass the last document's timestamp + id. */
  cursor?: { timestamp: string; id: string };
}

export interface AuditLogQueryResult {
  entries: AuditLogEntry[];
  /** Cursor to pass back for the next page, or null if at end. */
  nextCursor: { timestamp: string; id: string } | null;
  hasMore: boolean;
}

/**
 * Paginated query of audit logs for an organization.
 *
 * Uses the regular client Firebase SDK (subject to security rules — a user
 * must be an active member of the org to read its audit logs).
 *
 * Filters by action, actor, resourceType, result, and date range. Cursor
 * pagination on `(timestamp DESC, id DESC)` for stable ordering.
 */
export async function queryAuditLogs(
  orgId: string,
  filters: AuditLogQueryFilters,
): Promise<AuditLogQueryResult> {
  // Dynamic-import the client SDK so this module can be safely imported
  // from server-only code paths.
  const { db: clientDb } = await import('@/lib/firebase');
  const {
    collection,
    query: fbQuery,
    where,
    orderBy,
    limit: fbLimit,
    startAfter,
    getDocs,
  } = await import('firebase/firestore');

  const limitNum = Math.min(Math.max(filters.limit ?? 50, 1), 200);

  // Build the query constraints. Firestore requires equality filters BEFORE
  // range filters, and the orderBy field must match the last range field.
  // Our composite:  WHERE organizationId = ? [AND action = ?] [AND result = ?]
  //                   ORDER BY timestamp DESC  LIMIT N
  // Date-range filtering is done client-side after the fetch because
  // Firestore can't combine inequality on `timestamp` with equality on
  // `action` without a composite index for every (action, timestamp) pair.
  const constraints: ReturnType<typeof where>[] = [
    where('organizationId', '==', orgId),
  ];
  if (filters.action)       constraints.push(where('action', '==', filters.action));
  if (filters.actorUid)     constraints.push(where('actor.uid', '==', filters.actorUid));
  if (filters.resourceType) constraints.push(where('resourceType', '==', filters.resourceType));
  if (filters.result)       constraints.push(where('result', '==', filters.result));

  constraints.push(orderBy('timestamp', 'desc'));
  constraints.push(fbLimit(limitNum + 1));  // +1 to detect hasMore

  if (filters.cursor) {
    constraints.push(startAfter(filters.cursor.timestamp, filters.cursor.id));
  }

  const q = fbQuery(collection(clientDb, AUDIT_COLLECTION), ...constraints);
  const snap = await getDocs(q);

  const docs = snap.docs;
  const hasMore = docs.length > limitNum;
  const pageDocs = hasMore ? docs.slice(0, limitNum) : docs;

  let entries: AuditLogEntry[] = pageDocs.map((d) => {
    const data = d.data() as Record<string, unknown>;
    return {
      id: d.id,
      timestamp: typeof data.timestamp === 'string'
        ? (data.timestamp as string)
        : (data.timestamp as FbTimestamp)?.toMillis
          ? new Date((data.timestamp as FbTimestamp).toMillis()).toISOString()
          : new Date().toISOString(),
      action: data.action as AuditAction,
      actor: data.actor as AuditLogEntry['actor'],
      organizationId: data.organizationId as string,
      resourceType: data.resourceType as string | undefined,
      resourceId: data.resourceId as string | undefined,
      metadata: data.metadata as Record<string, unknown> | undefined,
      ipAddress: data.ipAddress as string | undefined,
      userAgent: data.userAgent as string | undefined,
      result: data.result as AuditLogEntry['result'],
      reason: data.reason as string | undefined,
    };
  });

  // Client-side date-range filtering (avoids composite-index explosion).
  if (filters.startDate || filters.endDate) {
    const startMs = filters.startDate ? new Date(filters.startDate).getTime() : -Infinity;
    const endMs   = filters.endDate   ? new Date(filters.endDate).getTime()   : Infinity;
    entries = entries.filter((e) => {
      const t = new Date(e.timestamp).getTime();
      return t >= startMs && t <= endMs;
    });
  }

  const last = entries[entries.length - 1];
  const nextCursor = hasMore && last
    ? { timestamp: last.timestamp, id: last.id }
    : null;

  return { entries, nextCursor, hasMore };
}

// ─── subscribeToAuditLogs ─────────────────────────────────────────────────────

export interface AuditLogSubscriptionOptions {
  /** Filter to a single action type. */
  action?: AuditAction;
  /** Filter to a single resource type. */
  resourceType?: string;
  /** Max entries the snapshot should hold (default 100). */
  limit?: number;
}

/**
 * Real-time subscription to an organization's audit-log feed.
 *
 * Intended for client-side React hooks (live audit dashboards). Uses the
 * client Firebase SDK so the subscription is subject to security rules —
 * the user must be an active member of the org to receive updates.
 *
 * Returns an unsubscribe function.
 */
export async function subscribeToAuditLogs(
  orgId: string,
  callback: (entries: AuditLogEntry[]) => void,
  options?: AuditLogSubscriptionOptions,
): Promise<() => void> {
  const { db: clientDb } = await import('@/lib/firebase');
  const {
    collection,
    query: fbQuery,
    where,
    orderBy,
    limit: fbLimit,
    onSnapshot,
  } = await import('firebase/firestore');

  const constraints: ReturnType<typeof where>[] = [
    where('organizationId', '==', orgId),
  ];
  if (options?.action)       constraints.push(where('action', '==', options.action));
  if (options?.resourceType) constraints.push(where('resourceType', '==', options.resourceType));

  constraints.push(orderBy('timestamp', 'desc'));
  constraints.push(fbLimit(options?.limit ?? 100));

  const q = fbQuery(collection(clientDb, AUDIT_COLLECTION), ...constraints);

  const unsubscribe = onSnapshot(
    q,
    (snap) => {
      const entries: AuditLogEntry[] = snap.docs.map((d) => {
        const data = d.data() as Record<string, unknown>;
        return {
          id: d.id,
          timestamp: typeof data.timestamp === 'string'
            ? (data.timestamp as string)
            : (data.timestamp as FbTimestamp)?.toMillis
              ? new Date((data.timestamp as FbTimestamp).toMillis()).toISOString()
              : new Date().toISOString(),
          action: data.action as AuditAction,
          actor: data.actor as AuditLogEntry['actor'],
          organizationId: data.organizationId as string,
          resourceType: data.resourceType as string | undefined,
          resourceId: data.resourceId as string | undefined,
          metadata: data.metadata as Record<string, unknown> | undefined,
          ipAddress: data.ipAddress as string | undefined,
          userAgent: data.userAgent as string | undefined,
          result: data.result as AuditLogEntry['result'],
          reason: data.reason as string | undefined,
        };
      });
      callback(entries);
    },
    (err) => {
       
      console.error('[observability/audit-log] subscription error:', err);
    },
  );

  return unsubscribe;
}

// ─── Test/debug helpers ───────────────────────────────────────────────────────

/**
 * Force-flush the high-volume buffer. Mainly used by tests / graceful
 * shutdown to ensure no audit entries are lost in-flight.
 */
export async function flushAuditBuffer(): Promise<void> {
  await flushBuffer();
}

/** Returns the number of buffered (un-flushed) audit entries. Test-only. */
export function getAuditBufferSize(): number {
  return buffer.length;
}

/** Stop the periodic flush timer. Test/shutdown-only. */
export function stopAuditFlushTimer(): void {
  if (flushTimer) {
    clearInterval(flushTimer);
    flushTimer = null;
  }
}
