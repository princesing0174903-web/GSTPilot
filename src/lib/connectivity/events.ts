// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT GLOBAL CONNECTIVITY FABRIC™ — EVENT STREAM ENGINE
// Every connector publishes events. Oracle reacts instantly. All events
// derive from real connector operations + real Prisma business records.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import type { ConnectorCategory, ConnectorEventRecord } from './types';
import { classifyCategory } from './engine';

// ─── Read recent events ──────────────────────────────────────────────────────────
export async function getRecentEvents(limit = 50, firmId?: string | null): Promise<ConnectorEventRecord[]> {
  const where = firmId ? { firmId } : {};
  const rows = await db.connectorEvent.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: { connector: { select: { provider: true, category: true } } },
  });

  return rows.map((r) => ({
    id: r.id,
    firmId: r.firmId,
    connectorId: r.connectorId,
    connectorKey: r.connectorKey,
    provider: r.connector?.provider ?? r.connectorKey,
    category: r.connector ? classifyCategory(r.connector.category) : ('devtools' as ConnectorCategory),
    type: r.type,
    severity: r.severity as ConnectorEventRecord['severity'],
    title: r.title,
    description: r.description,
    payload: r.payload ? safeParse<Record<string, unknown>>(r.payload, {}) : null,
    externalId: r.externalId,
    reaction: r.reaction,
    reactionNote: r.reactionNote,
    createdAt: r.createdAt.toISOString(),
  }));
}

// ─── Event type catalog (describes what each type means) ────────────────────────
export const EVENT_TYPE_CATALOG: Array<{ type: string; label: string; severity: 'info' | 'low' | 'medium' | 'high' | 'critical'; description: string }> = [
  { type: 'invoice.paid', label: 'Invoice Paid', severity: 'info', description: 'A connector reported an invoice as paid (bank/payment gateway).' },
  { type: 'gst.filed', label: 'GST Filed', severity: 'info', description: 'GSTR return filing confirmed by GSTN connector.' },
  { type: 'payment.received', label: 'Payment Received', severity: 'info', description: 'Inbound payment confirmed by bank/payment connector.' },
  { type: 'bank.updated', label: 'Bank Updated', severity: 'info', description: 'Bank connector delivered new transactions.' },
  { type: 'vendor.added', label: 'Vendor Added', severity: 'low', description: 'New vendor created in ERP/accounting connector.' },
  { type: 'employee.joined', label: 'Employee Joined', severity: 'low', description: 'New employee onboarded via HRMS connector.' },
  { type: 'contract.signed', label: 'Contract Signed', severity: 'medium', description: 'Contract execution confirmed via e-sign connector.' },
  { type: 'order.delivered', label: 'Order Delivered', severity: 'info', description: 'Order delivery confirmed by logistics connector.' },
  { type: 'message.received', label: 'Message Received', severity: 'info', description: 'Inbound message from communication connector.' },
  { type: 'auth.expired', label: 'Auth Expired', severity: 'high', description: 'Connector credential has expired — re-authentication required.' },
  { type: 'sync.completed', label: 'Sync Completed', severity: 'info', description: 'Scheduled or manual sync finished successfully.' },
  { type: 'sync.failed', label: 'Sync Failed', severity: 'high', description: 'Sync encountered an error — review logs and retry.' },
  { type: 'webhook.received', label: 'Webhook Received', severity: 'low', description: 'Inbound webhook from connector.' },
  { type: 'auth.success', label: 'Auth Success', severity: 'info', description: 'Connector authenticated successfully.' },
  { type: 'connector.installed', label: 'Connector Installed', severity: 'info', description: 'New connector installed.' },
];

// ─── Aggregate event stats (24h) ─────────────────────────────────────────────────
export async function getEventStats24h(firmId?: string | null): Promise<{
  total: number;
  byType: Record<string, number>;
  bySeverity: Record<string, number>;
  oracleReactions: number;
}> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const where = {
    createdAt: { gte: since },
    ...(firmId ? { firmId } : {}),
  };

  const rows = await db.connectorEvent.findMany({
    where,
    select: { type: true, severity: true, reaction: true },
  });

  const byType: Record<string, number> = {};
  const bySeverity: Record<string, number> = {};
  let oracleReactions = 0;

  for (const r of rows) {
    byType[r.type] = (byType[r.type] ?? 0) + 1;
    bySeverity[r.severity] = (bySeverity[r.severity] ?? 0) + 1;
    if (r.reaction === 'oracle_reacted') oracleReactions++;
  }

  return { total: rows.length, byType, bySeverity, oracleReactions };
}

// ─── Helper: safe JSON parse ─────────────────────────────────────────────────────
function safeParse<T>(raw: string, fallback: T): T {
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}

// ─── Bridge: surface real BusinessEvents as ConnectorEvents ──────────────────────
// This is how Oracle reacts to events from existing GST/banking/communication
// connectors — they're surfaced in the connectivity event stream.
export async function getBusinessEventsAsConnectorEvents(limit = 25, firmId?: string | null): Promise<ConnectorEventRecord[]> {
  const where = firmId ? { businessId: firmId } : {};
  const events = await db.businessEvent.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  return events.map((e) => ({
    id: `be_${e.id}`,
    firmId: e.businessId,
    connectorId: 'internal',
    connectorKey: `internal.${e.source}`,
    provider: e.source.charAt(0).toUpperCase() + e.source.slice(1),
    category: 'devtools' as ConnectorCategory,
    type: e.type,
    severity: e.severity as ConnectorEventRecord['severity'],
    title: e.type.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase()),
    description: e.payload ? safeParse<string | null>(e.payload, null) : null,
    payload: e.payload ? safeParse<Record<string, unknown>>(e.payload, {}) : null,
    externalId: e.id,
    reaction: e.status === 'resolved' ? 'oracle_reacted' : null,
    reactionNote: e.status === 'acknowledged' ? 'Acknowledged' : e.status === 'resolved' ? 'Resolved' : null,
    createdAt: e.createdAt.toISOString(),
  }));
}
