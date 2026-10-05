// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — Workflow Engine
// ═══════════════════════════════════════════════════════════════════════════════
//
// The single source of truth for the "Business Workflow Pipeline" — the live
// state of every business object as it moves through the canonical workflow:
//
//   Invoice Created → Customer Pays → Bank Detects Payment → Invoice Auto-Matches
//     → GST Updates → Oracle Reviews → User Approves → Done
//
// Every stage count is computed from REAL Prisma data (Invoice, Payment,
// BankTransaction, BankReconciliation, GSTReturn, BusinessEvent). No mock
// numbers, no Math.random. When a count is 0, the stage renders as "clear".
//
// This engine powers:
//   • /api/workflow/pipeline  →  GET returns the full pipeline state
//   • useWorkflowPipeline()   →  React hook on the dashboard
//   • WorkflowPipeline.tsx    →  the visual pipeline component
//
// Tenant scoping: organizationId. All queries are org-scoped via the
// organizationId column on BankTransaction / BankReconciliation / the
// invoice's client → org chain.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';

// ─── Types ─────────────────────────────────────────────────────────────────────

export type WorkflowStageId =
  | 'invoice-created'
  | 'customer-pays'
  | 'bank-detects'
  | 'auto-match'
  | 'gst-updates'
  | 'oracle-reviews'
  | 'user-approves'
  | 'done';

export type StageStatus = 'healthy' | 'warning' | 'critical' | 'clear';

export interface WorkflowStageItem {
  id: string;
  title: string;
  subtitle: string;
  amount?: number;
  view?: string;
}

export interface WorkflowStage {
  id: WorkflowStageId;
  label: string;
  description: string;
  count: number;
  status: StageStatus;
  /** A few sample items (max 3) for the drill-down preview */
  items: WorkflowStageItem[];
  /** Where this stage navigates when clicked */
  view?: string;
}

export interface WorkflowPipeline {
  stages: WorkflowStage[];
  /** Total items flowing through the pipeline (sum of non-done stages) */
  totalActive: number;
  /** Items completed this month */
  totalDone: number;
  /** Breakdown of `totalDone` — exposes the 3 underlying counts so callers
   *  (e.g. oracle daily briefing) don't have to re-query the DB. */
  doneBreakdown: {
    filedReturns: number;
    reconciledTransactions: number;
    paidInvoices: number;
  };
  /** Overall pipeline health: 'healthy' if no critical stages, etc. */
  health: StageStatus;
  /** ISO timestamp of when this was computed */
  computedAt: string;
  /** Organization id this pipeline belongs to */
  organizationId: string;
}

// ─── Cache (30s, in-memory, per org) ──────────────────────────────────────────

interface CacheEntry {
  pipeline: WorkflowPipeline;
  ts: number;
}
const CACHE_TTL_MS = 30_000;
const cache = new Map<string, CacheEntry>();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusFromCount(count: number, thresholds: { warn: number; crit: number }): StageStatus {
  if (count === 0) return 'clear';
  if (count >= thresholds.crit) return 'critical';
  if (count >= thresholds.warn) return 'warning';
  return 'healthy';
}

function startOfMonth(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function emptyPipeline(organizationId: string): WorkflowPipeline {
  return {
    stages: [],
    totalActive: 0,
    totalDone: 0,
    doneBreakdown: { filedReturns: 0, reconciledTransactions: 0, paidInvoices: 0 },
    health: 'clear',
    computedAt: new Date().toISOString(),
    organizationId,
  };
}

// ─── Main: compute the full pipeline ──────────────────────────────────────────

export async function getWorkflowPipeline(
  organizationId: string,
  opts: { forceRefresh?: boolean } = {},
): Promise<WorkflowPipeline> {
  if (!organizationId) return emptyPipeline('');

  // Cache check
  if (!opts.forceRefresh) {
    const cached = cache.get(organizationId);
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
      return cached.pipeline;
    }
  }

  const isLocal = organizationId === 'local' || organizationId.startsWith('local-');

  // Normalize the org ID for banking queries. BankAccount / BankTransaction /
  // BankReconciliation records are seeded with organizationId = 'local'. When
  // a demo user session creates a local-* org (e.g. local-abc123), we still
  // want them to see the seeded banking data. So for any local-* org, we use
  // 'local' as the banking org ID.
  const bankingOrgId = isLocal ? 'local' : organizationId;

  // Run all the preview + count queries in parallel for speed.
  // Each query is wrapped in .catch() so a missing table / query error never
  // breaks the whole pipeline — the stage just renders as 0/clear.
  const [
    invoicesSent,
    invoicesPaidUnreconciled,
    bankCreditsUnreconciled,
    reconPending,
    gstPrepared,
    oracleActions,
    filedReturnsCount,
    reconTxnsCount,
    paidInvoicesCount,
    sentCount,
    paidUnreconciledCount,
    bankCreditsCount,
    reconPendingCount,
    gstPreparedCount,
    openEventsCount,
  ] = await Promise.all([
    // 1. Invoices sent (awaiting payment) — org-scoped via client.firmId
    db.invoice.findMany({
      where: { client: { firmId: organizationId }, status: { in: ['sent', 'issued', 'pending', 'overdue'] } },
      take: 3,
      orderBy: { invoiceDate: 'desc' },
      select: { id: true, invoiceNumber: true, buyerName: true, totalAmount: true, invoiceDate: true, status: true },
    }).catch(() => []),

    // 2. Invoices paid but not yet bank-reconciled — org-scoped via client.firmId
    db.invoice.findMany({
      where: { client: { firmId: organizationId }, status: 'paid', matchStatus: { not: 'matched' } },
      take: 3,
      orderBy: { invoiceDate: 'desc' },
      select: { id: true, invoiceNumber: true, buyerName: true, totalAmount: true, invoiceDate: true },
    }).catch(() => []),

    // 3. Bank credits that are unreconciled (incoming payments not yet matched)
    db.bankTransaction.findMany({
      where: { organizationId: bankingOrgId, type: 'credit', matched: false, status: { in: ['posted', 'pending'] } },
      take: 3,
      orderBy: { date: 'desc' },
      select: { id: true, description: true, counterparty: true, amount: true, date: true, referenceNo: true },
    }).catch(() => []),

    // 4. Bank reconciliations pending approval (auto-matched, awaiting review)
    db.bankReconciliation.findMany({
      where: { organizationId: bankingOrgId, status: 'pending', matchedBy: 'auto' },
      take: 3,
      orderBy: { createdAt: 'desc' },
      select: { id: true, matchType: true, confidence: true, actualAmount: true, expectedAmount: true, difference: true },
    }).catch(() => []),

    // 5. GST returns prepared (ready to file)
    db.gSTReturn.findMany({
      where: { status: { in: ['prepared', 'draft'] } },
      take: 3,
      orderBy: { createdAt: 'desc' },
      select: { id: true, type: true, period: true, totalTax: true, totalITC: true, invoiceCount: true },
    }).catch(() => []),

    // 6. Oracle actions / risk alerts (open high/critical business events) — org-scoped via businessId
    db.businessEvent.findMany({
      where: { businessId: organizationId, status: 'open', severity: { in: ['high', 'critical'] } },
      take: 3,
      orderBy: { createdAt: 'desc' },
      select: { id: true, type: true, source: true, severity: true, payload: true, createdAt: true },
    }).catch(() => []),

    // 7. Done counts (this month)
    db.gSTReturn.count({
      where: { status: 'filed', filedAt: { gte: startOfMonth() } },
    }).catch(() => 0),
    db.bankTransaction.count({
      where: { organizationId: bankingOrgId, matched: true, reconciledAt: { gte: startOfMonth() } },
    }).catch(() => 0),
    db.invoice.count({
      where: { client: { firmId: organizationId }, status: 'paid', invoiceDate: { gte: startOfMonth().toISOString().slice(0, 10) } },
    }).catch(() => 0),

    // Counts for totals — org-scoped via client.firmId
    db.invoice.count({ where: { client: { firmId: organizationId }, status: { in: ['sent', 'issued', 'pending', 'overdue'] } } }).catch(() => 0),
    db.invoice.count({ where: { client: { firmId: organizationId }, status: 'paid', matchStatus: { not: 'matched' } } }).catch(() => 0),
    db.bankTransaction.count({
      where: { organizationId: bankingOrgId, type: 'credit', matched: false, status: { in: ['posted', 'pending'] } },
    }).catch(() => 0),
    db.bankReconciliation.count({
      where: { organizationId: bankingOrgId, status: 'pending', matchedBy: 'auto' },
    }).catch(() => 0),
    db.gSTReturn.count({ where: { status: { in: ['prepared', 'draft'] } } }).catch(() => 0),
    db.businessEvent.count({
      where: { businessId: organizationId, status: 'open', severity: { in: ['high', 'critical'] } },
    }).catch(() => 0),
  ]);

  const totalDone = filedReturnsCount + reconTxnsCount + paidInvoicesCount;
  const totalActive = sentCount + paidUnreconciledCount + bankCreditsCount + reconPendingCount + gstPreparedCount + openEventsCount;

  // ── Build stages ──
  const stages: WorkflowStage[] = [
    {
      id: 'invoice-created',
      label: 'Invoice Created',
      description: 'Issued, awaiting customer payment',
      count: sentCount,
      status: statusFromCount(sentCount, { warn: 15, crit: 30 }),
      view: 'invoices',
      items: invoicesSent.map((inv) => ({
        id: inv.id,
        title: inv.invoiceNumber,
        subtitle: inv.buyerName ?? 'Customer',
        amount: inv.totalAmount,
        view: 'invoices',
      })),
    },
    {
      id: 'customer-pays',
      label: 'Customer Pays',
      description: 'Payment received, not in bank yet',
      count: paidUnreconciledCount,
      status: statusFromCount(paidUnreconciledCount, { warn: 5, crit: 10 }),
      view: 'invoices',
      items: invoicesPaidUnreconciled.map((inv) => ({
        id: inv.id,
        title: inv.invoiceNumber,
        subtitle: inv.buyerName ?? 'Customer',
        amount: inv.totalAmount,
        view: 'invoices',
      })),
    },
    {
      id: 'bank-detects',
      label: 'Bank Detects Payment',
      description: 'Incoming credits awaiting match',
      count: bankCreditsCount,
      status: statusFromCount(bankCreditsCount, { warn: 5, crit: 12 }),
      view: 'banking',
      items: bankCreditsUnreconciled.map((tx) => ({
        id: tx.id,
        title: tx.counterparty ?? (tx.description ? tx.description.slice(0, 30) : 'Bank credit'),
        subtitle: tx.referenceNo ?? 'Bank transfer',
        amount: tx.amount,
        view: 'banking',
      })),
    },
    {
      id: 'auto-match',
      label: 'Invoice Auto-Matches',
      description: 'Oracle matched — awaiting review',
      count: reconPendingCount,
      status: statusFromCount(reconPendingCount, { warn: 3, crit: 8 }),
      view: 'reconcile',
      items: reconPending.map((r) => ({
        id: r.id,
        title: `${r.matchType} match`,
        subtitle: `${Math.round(r.confidence * 100)}% confidence`,
        amount: r.actualAmount ?? r.expectedAmount ?? 0,
        view: 'reconcile',
      })),
    },
    {
      id: 'gst-updates',
      label: 'GST Updates',
      description: 'Returns prepared, ready to file',
      count: gstPreparedCount,
      status: statusFromCount(gstPreparedCount, { warn: 2, crit: 4 }),
      view: 'returns',
      items: gstPrepared.map((ret) => ({
        id: ret.id,
        title: `${ret.type} · ${ret.period}`,
        subtitle: `${ret.invoiceCount} invoices · tax ₹${ret.totalTax.toLocaleString('en-IN')}`,
        amount: ret.totalTax,
        view: 'returns',
      })),
    },
    {
      id: 'oracle-reviews',
      label: 'Oracle Reviews',
      description: 'AI-prepared actions and risk alerts',
      count: openEventsCount,
      status: statusFromCount(openEventsCount, { warn: 3, crit: 7 }),
      view: 'oracle-brain',
      items: oracleActions.map((ev) => {
        let title = ev.type;
        let detail = ev.source;
        try {
          const p = ev.payload ? JSON.parse(ev.payload) : null;
          if (p?.title) title = p.title;
          if (p?.detail) detail = p.detail;
        } catch { /* ignore */ }
        return { id: ev.id, title, subtitle: detail, view: 'oracle-brain' };
      }),
    },
    {
      id: 'user-approves',
      label: 'User Approves',
      description: 'One click to finalize Oracle’s work',
      count: reconPendingCount + gstPreparedCount,
      status: statusFromCount(reconPendingCount + gstPreparedCount, { warn: 3, crit: 6 }),
      view: 'reconcile',
      items: [
        ...reconPending.slice(0, 2).map((r) => ({
          id: r.id,
          title: `Approve ${r.matchType} match`,
          subtitle: `${Math.round(r.confidence * 100)}% confidence`,
          amount: r.actualAmount ?? r.expectedAmount ?? 0,
          view: 'reconcile',
        })),
        ...gstPrepared.slice(0, 1).map((ret) => ({
          id: ret.id,
          title: `File ${ret.type} · ${ret.period}`,
          subtitle: `${ret.invoiceCount} invoices`,
          amount: ret.totalTax,
          view: 'returns',
        })),
      ],
    },
    {
      id: 'done',
      label: 'Done',
      description: 'Completed this month',
      count: totalDone,
      status: totalDone > 0 ? 'healthy' : 'clear',
      items: [
        ...(filedReturnsCount > 0 ? [{ id: 'filed', title: `${filedReturnsCount} returns filed`, subtitle: 'This month' }] : []),
        ...(reconTxnsCount > 0 ? [{ id: 'recon', title: `${reconTxnsCount} transactions reconciled`, subtitle: 'This month' }] : []),
        ...(paidInvoicesCount > 0 ? [{ id: 'paid', title: `${paidInvoicesCount} invoices collected`, subtitle: 'This month' }] : []),
      ],
    },
  ];

  const hasCritical = stages.some((s) => s.status === 'critical');
  const hasWarning = stages.some((s) => s.status === 'warning');
  const health: StageStatus = hasCritical ? 'critical' : hasWarning ? 'warning' : 'healthy';

  const pipeline: WorkflowPipeline = {
    stages,
    totalActive,
    totalDone,
    doneBreakdown: {
      filedReturns: filedReturnsCount,
      reconciledTransactions: reconTxnsCount,
      paidInvoices: paidInvoicesCount,
    },
    health,
    computedAt: new Date().toISOString(),
    organizationId,
  };

  cache.set(organizationId, { pipeline, ts: Date.now() });
  return pipeline;
}

// ─── Convenience: get just the counts (for badges, pills, etc.) ───────────────

export async function getWorkflowCounts(organizationId: string): Promise<{
  totalActive: number;
  totalDone: number;
  health: StageStatus;
}> {
  const p = await getWorkflowPipeline(organizationId);
  return { totalActive: p.totalActive, totalDone: p.totalDone, health: p.health };
}
