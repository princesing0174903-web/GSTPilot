// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — Shared Service Layer: Types
// ═══════════════════════════════════════════════════════════════════════════════
//
// The canonical business-logic layer that BOTH the REST API routes (in
// /api/...) AND the Oracle Action Engine call. This guarantees Oracle
// performs the EXACT same writes, audit-log entries, graph events, timeline
// events, and activity logs as the normal UI — zero duplication.
//
// Every service function:
//   • performs the real Prisma write
//   • writes an AuditLog row
//   • fires the Business Graph live event (+ canonical node emit)
//   • emits a Business Timeline event
//   • logs an Activity row (for the dashboard activity feed)
//   • is fire-and-forget safe for side effects (never throws on side-effect failure)
//
// The API routes become thin HTTP wrappers around these functions; the Oracle
// action definitions call them directly. Either path produces identical side
// effects — the dashboard and Oracle always stay in sync.
// ═══════════════════════════════════════════════════════════════════════════════

/** The actor performing an action (for audit log + timeline attribution). */
export interface Actor {
  userId?: string;
  userName?: string;
}

/** Standard service result — success carries data, failure carries an error message. */
export interface ServiceResult<T = Record<string, unknown>> {
  ok: boolean;
  data?: T;
  error?: string;
  /** HTTP-ish status code for the API route to mirror. */
  status?: number;
}
