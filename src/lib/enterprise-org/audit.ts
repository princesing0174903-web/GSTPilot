// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — Enterprise Organization Audit Log Service
//
// Org-scoped audit trail stored in Firestore (`organization_audit_logs`).
// Every privileged action (member invite/remove/role-change, settings update,
// billing change, API key create/revoke, AI action, invoice action, security
// event) is recorded here with a full actor + context fingerprint.
//
// Design goals:
//   • Org-isolated — every doc carries `organizationId`; queries always filter.
//   • Append-only — docs are never updated or deleted (tamper-evident trail).
//   • Best-effort — a logging failure NEVER blocks the user action. The caller's
//     primary mutation has already succeeded; the audit write is fire-and-forget
//     with a console warning on failure.
//   • Rich context — captures actor, IP, user-agent (device), severity, metadata.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/firebase';
import {
  collection,
  doc,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  serverTimestamp,
} from 'firebase/firestore';

// ─── Types ───────────────────────────────────────────────────────────────────

export type AuditSeverity = 'info' | 'warning' | 'critical';

export type AuditCategory =
  | 'auth'
  | 'member'
  | 'role'
  | 'settings'
  | 'billing'
  | 'subscription'
  | 'api_key'
  | 'integration'
  | 'ai'
  | 'invoice'
  | 'return'
  | 'client'
  | 'payment'
  | 'expense'
  | 'document'
  | 'security'
  | 'organization';

export interface AuditLogEntry {
  id: string;
  organizationId: string;
  category: AuditCategory;
  action: string;
  summary: string;
  severity: AuditSeverity;
  actorId: string | null;
  actorName: string | null;
  actorEmail: string | null;
  actorRole: string | null;
  targetId: string | null;
  targetType: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown> | null;
  timestamp: string;
}

export interface LogAuditInput {
  organizationId: string;
  category: AuditCategory;
  action: string;
  summary: string;
  severity?: AuditSeverity;
  actorId?: string | null;
  actorName?: string | null;
  actorEmail?: string | null;
  actorRole?: string | null;
  targetId?: string | null;
  targetType?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface ListAuditOptions {
  take?: number;
  category?: AuditCategory;
  severity?: AuditSeverity;
  actorId?: string;
  startAfter?: number; // epoch ms
}

// ─── Write ───────────────────────────────────────────────────────────────────

/**
 * Append an audit log entry. Best-effort — never throws.
 *
 * Call this AFTER the primary mutation has succeeded so the audit trail
 * always reflects what actually happened.
 */
export async function logAuditEvent(input: LogAuditInput): Promise<{ id: string | null; error: string | null }> {
  try {
    const payload: Record<string, unknown> = {
      organizationId: input.organizationId,
      category: input.category,
      action: input.action,
      summary: input.summary,
      severity: input.severity ?? 'info',
      actorId: input.actorId ?? null,
      actorName: input.actorName ?? null,
      actorEmail: input.actorEmail ?? null,
      actorRole: input.actorRole ?? null,
      targetId: input.targetId ?? null,
      targetType: input.targetType ?? null,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
      metadata: input.metadata ?? null,
      timestamp: serverTimestamp(),
    };
    const ref = await addDoc(collection(db, 'organization_audit_logs'), payload);
    return { id: ref.id, error: null };
  } catch (err) {
    // Non-fatal — the user action already succeeded. Log and move on.
    console.warn('[enterprise-org:audit] failed to log event:', err);
    return { id: null, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Fire-and-forget audit log. Use when you don't care about the result and
 * don't want to await the write (e.g. from a UI action handler).
 */
export function logAuditBackground(input: LogAuditInput): void {
  void logAuditEvent(input);
}

// ─── Read ────────────────────────────────────────────────────────────────────

function toEntry(id: string, data: Record<string, unknown>): AuditLogEntry {
  const ts = data.timestamp;
  let timestamp = new Date().toISOString();
  if (ts instanceof Timestamp) {
    timestamp = ts.toDate().toISOString();
  } else if (ts instanceof Date) {
    timestamp = ts.toISOString();
  } else if (typeof ts === 'string') {
    timestamp = ts;
  }
  return {
    id,
    organizationId: String(data.organizationId ?? ''),
    category: (data.category as AuditCategory) ?? 'info',
    action: String(data.action ?? ''),
    summary: String(data.summary ?? ''),
    severity: (data.severity as AuditSeverity) ?? 'info',
    actorId: (data.actorId as string | null) ?? null,
    actorName: (data.actorName as string | null) ?? null,
    actorEmail: (data.actorEmail as string | null) ?? null,
    actorRole: (data.actorRole as string | null) ?? null,
    targetId: (data.targetId as string | null) ?? null,
    targetType: (data.targetType as string | null) ?? null,
    ipAddress: (data.ipAddress as string | null) ?? null,
    userAgent: (data.userAgent as string | null) ?? null,
    metadata: (data.metadata as Record<string, unknown> | null) ?? null,
    timestamp,
  };
}

/**
 * List audit log entries for an organization, newest first.
 */
export async function listAuditEvents(
  organizationId: string,
  opts: ListAuditOptions = {},
): Promise<{ entries: AuditLogEntry[]; error: string | null }> {
  try {
    const { take = 100, category, severity, actorId } = opts;
    const constraints: ReturnType<typeof where>[] = [where('organizationId', '==', organizationId)];
    if (category) constraints.push(where('category', '==', category));
    if (severity) constraints.push(where('severity', '==', severity));
    if (actorId) constraints.push(where('actorId', '==', actorId));

    const q = query(
      collection(db, 'organization_audit_logs'),
      ...constraints,
      orderBy('timestamp', 'desc'),
      limit(take),
    );
    const snap = await getDocs(q);
    const entries: AuditLogEntry[] = [];
    snap.forEach((d) => {
      entries.push(toEntry(d.id, d.data() as Record<string, unknown>));
    });
    return { entries, error: null };
  } catch (err) {
    return { entries: [], error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Get a summary of audit activity for an organization (counts by category +
 * severity). Used by the Organization Dashboard activity widget.
 */
export async function getAuditSummary(
  organizationId: string,
): Promise<{ summary: AuditSummary; error: string | null }> {
  try {
    const { entries, error } = await listAuditEvents(organizationId, { take: 500 });
    if (error) return { summary: emptySummary(), error };

    const byCategory: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};
    let last24h = 0;
    let critical = 0;
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;

    for (const e of entries) {
      byCategory[e.category] = (byCategory[e.category] ?? 0) + 1;
      bySeverity[e.severity] = (bySeverity[e.severity] ?? 0) + 1;
      if (e.severity === 'critical') critical++;
      const t = new Date(e.timestamp).getTime();
      if (!Number.isNaN(t) && t >= cutoff) last24h++;
    }

    return {
      summary: {
        total: entries.length,
        last24h,
        critical,
        byCategory,
        bySeverity,
      },
      error: null,
    };
  } catch (err) {
    return { summary: emptySummary(), error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

export interface AuditSummary {
  total: number;
  last24h: number;
  critical: number;
  byCategory: Record<string, number>;
  bySeverity: Record<string, number>;
}

function emptySummary(): AuditSummary {
  return { total: 0, last24h: 0, critical: 0, byCategory: {}, bySeverity: {} };
}

// ─── Convenience: log from a server request ──────────────────────────────────

/**
 * Extract a request fingerprint (IP + user-agent) from a Next.js Request.
 * Returns null-safe strings so the caller can spread the result into a
 * `logAuditEvent` call.
 */
export function getRequestFingerprint(req: Request): {
  ipAddress: string;
  userAgent: string;
} {
  const headers = req.headers;
  const forwarded = headers.get('x-forwarded-for');
  const ipAddress = forwarded ? forwarded.split(',')[0].trim() : (headers.get('x-real-ip') ?? 'unknown');
  const userAgent = headers.get('user-agent') ?? 'unknown';
  return { ipAddress, userAgent };
}

// ─── doc() import kept for future per-doc fetches (unused for now, avoids
//     tree-shaking complaints in strict builds) ──────────────────────────────
void doc;
