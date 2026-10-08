// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO — Business Timeline Event System
//
// Single source of truth for emitting + reading timeline events.
// Uses Prisma `BusinessEvent` table (NOT Firestore) — schema:
//   { id, businessId, type, source, payload(JSON string), severity, status, createdAt }
//
// emitTimelineEvent() is fire-and-forget safe — NEVER throws to caller.
// listTimelineEvents() returns the most recent events, org-scoped.
//
// Every important CRUD action (customer created, invoice created, invoice paid,
// Zoho sync, Google connected, Oracle activated, return created, expense created,
// payment received) calls emitTimelineEvent() so the Business Timeline widget
// on the dashboard reflects real user activity in real time.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';

// Re-export isLocalOrgId so callers that import from this module (e.g.
// snapshot.ts) get a single consolidated surface for timeline + org checks.
export { isLocalOrgId } from '@/lib/gstpilot-data/local-workspace';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TimelineEventInput {
  organizationId: string;
  type: string;
  title: string;
  description?: string;
  actor?: { userId?: string; userName?: string };
  metadata?: Record<string, unknown>;
  severity?: 'info' | 'success' | 'warning' | 'critical';
}

export interface TimelineEvent {
  id: string;
  type: string;
  title: string;
  description: string | null;
  severity: 'info' | 'success' | 'warning' | 'critical';
  source: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  organizationId: string;
  actor?: { userId?: string; userName?: string };
}

// ─── Emit ─────────────────────────────────────────────────────────────────────

/**
 * Emit a timeline event. Fire-and-forget safe — never throws to caller.
 *
 * Skips silently for local- org IDs (no Prisma data for guest/demo users).
 * Logs a warning on failure but does NOT propagate the error.
 */
export async function emitTimelineEvent(input: TimelineEventInput): Promise<void> {
  try {
    if (!input.organizationId) return;
    if (input.organizationId.startsWith('local-')) return; // local- orgs have no Prisma data

    const payload = JSON.stringify({
      title: input.title,
      description: input.description ?? null,
      metadata: input.metadata ?? {},
      actor: input.actor ?? {},
    });

    await db.businessEvent.create({
      data: {
        businessId: input.organizationId,
        type: input.type,
        source: input.actor?.userId ? 'user' : 'system',
        payload,
        severity: input.severity ?? 'info',
        status: 'open',
      },
    });
  } catch (err) {
    // Non-fatal — timeline is a "nice to have" display layer. Never break
    // the parent operation (invoice creation, payment, sync, etc.) because
    // the timeline emit failed.
    console.warn(
      '[timeline] emit failed (non-fatal):',
      err instanceof Error ? err.message : err,
    );
  }
}

// ─── List ─────────────────────────────────────────────────────────────────────

/**
 * List the most recent timeline events for an organization.
 *
 * For local- org IDs, returns [] (no Prisma data). Never throws.
 */
export async function listTimelineEvents(
  organizationId: string,
  limit = 50,
): Promise<TimelineEvent[]> {
  try {
    if (!organizationId) return [];
    if (organizationId.startsWith('local-')) return [];

    const rows = await db.businessEvent.findMany({
      where: { businessId: organizationId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 200),
    });

    return rows.map((r) => {
      let parsed: {
        title?: string;
        description?: string | null;
        metadata?: Record<string, unknown>;
        actor?: { userId?: string; userName?: string };
      } = {};
      try {
        parsed = r.payload ? JSON.parse(r.payload) : {};
      } catch {
        parsed = {};
      }
      return {
        id: r.id,
        type: r.type,
        title: parsed.title ?? r.type,
        description: parsed.description ?? null,
        severity: (r.severity as TimelineEvent['severity']) ?? 'info',
        source: r.source,
        metadata: parsed.metadata ?? {},
        createdAt: r.createdAt.toISOString(),
        organizationId: r.businessId ?? organizationId,
        actor: parsed.actor,
      };
    });
  } catch (err) {
    console.warn(
      '[timeline] list failed (non-fatal):',
      err instanceof Error ? err.message : err,
    );
    return [];
  }
}
