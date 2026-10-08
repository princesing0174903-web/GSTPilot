// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO — Activity Logger (SERVER-ONLY)
//
// Small shared helper that writes a single activity record to the Firestore
// `activities` collection. Used by every create/connect/file API route so the
// Business Timeline on the home page picks up real events (integration
// connected, payment recorded, purchase created, GST return created, invoice
// created, Oracle insights generated, etc.).
//
// The activity shape mirrors what /api/oracle/activate writes — same fields,
// same metadata convention — so the Timeline renders them consistently.
//
// This helper is best-effort: if Firestore is unreachable or the admin SDK is
// not configured, the log call is swallowed so the calling route does not
// fail. Activity logging is observability, not a critical path.
// ═══════════════════════════════════════════════════════════════════════════════

import type { ActivityType } from '@/lib/firestore-schema';

export interface LogActivityInput {
  organizationId: string;
  userId: string | null;
  type: ActivityType;
  title: string;
  description: string;
  entityType?: string | null;
  entityId?: string | null;
  clientId?: string | null;
  metadata?: Record<string, string | number | boolean | null>;
}

/**
 * Write a single activity record to Firestore. Best-effort — never throws.
 *
 * Usage:
 *   await logActivity({
 *     organizationId,
 *     userId: decodedUid,
 *     type: 'invoice_created',
 *     title: 'Invoice Created',
 *     description: `Invoice INV-001 for ₹10,000 created for Acme Corp.`,
 *     entityType: 'invoice',
 *     entityId: invoiceId,
 *     metadata: { amount: 10000, clientName: 'Acme Corp.' },
 *   });
 */
export async function logActivity(input: LogActivityInput): Promise<void> {
  try {
    if (!input.organizationId) return; // No org = nothing to log under.
    const { adminDb } = await import('@/lib/firebase-admin');
    const nowIso = new Date().toISOString();
    const ref = adminDb().collection('activities').doc();
    await ref.set({
      activityId: ref.id,
      organizationId: input.organizationId,
      firmId: input.organizationId, // legacy field for backwards compatibility
      userId: input.userId ?? null,
      type: input.type,
      title: input.title,
      description: input.description,
      clientId: input.clientId ?? null,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      metadata: input.metadata ?? {},
      createdAt: nowIso,
    });
  } catch (err) {
    // Best-effort: never break the calling route because of an activity log.
    console.error('[activity-logger] failed to write activity:', err);
  }
}

/**
 * Best-effort Firebase ID token verification.
 *
 * Returns the decoded uid if the Bearer token is present and valid, otherwise
 * null. Use this in routes that want to log activities but don't strictly
 * require authentication (so unauthenticated callers still work, just without
 * attribution).
 */
export async function getOptionalUserId(req: Request): Promise<string | null> {
  try {
    const authHeader = req.headers.get('authorization') ?? '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return null;
    const { adminAuth } = await import('@/lib/firebase-admin');
    const decoded = await adminAuth().verifyIdToken(token);
    return decoded.uid;
  } catch {
    return null;
  }
}
