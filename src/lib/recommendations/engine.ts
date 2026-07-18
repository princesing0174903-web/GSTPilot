// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — Real Recommendations Engine
//
// Replaces the generic/mock AI recommendations with REAL recommendations derived
// from the Business Snapshot (single source of truth) + targeted Prisma queries.
//
// Two layers:
//   1. `generateRecommendationsFromSnapshot(snapshot)` — PURE function. Inspects
//      the snapshot's headline metrics (receivables, cash, health score, risk
//      score, pending returns, ITC) and fires deterministic rules. No DB access.
//   2. `getOverdueTomorrowInvoices / getRevenueDrop / getCustomerDelays /
//       getTopCustomerConcentration` — async Prisma enrichment functions for the
//      rules that need row-level data the snapshot does not expose.
//
// The /api/recommendations route calls the pure function, then enriches with the
// async queries, merges, and sorts by priority (critical → high → medium → low)
// then by dueInDays (sooner first).
//
// Design rules:
//   • Every rule fires ONLY when its condition is true — no fabricated content.
//   • Currency is formatted as ₹{amount} using Indian number system (lakh/crore).
//   • For local- org IDs (prefix `local-`), the snapshot returns zeros and the
//     Prisma queries return empty arrays — so most rules do not fire. This is
//     the correct, honest behaviour (no fake data for guests).
//   • Ids are deterministic (`rec-{type}-{hash}`) so the UI can key + de-dupe.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import type { BusinessSnapshot } from '@/lib/business/snapshot';

// ─── Types ────────────────────────────────────────────────────────────────────

export type RecommendationType =
  | 'cash'
  | 'receivables'
  | 'compliance'
  | 'growth'
  | 'risk'
  | 'customer';

export type RecommendationPriority = 'critical' | 'high' | 'medium' | 'low';

export interface Recommendation {
  id: string;
  type: RecommendationType;
  priority: RecommendationPriority;
  title: string;
  description: string;
  metric?: { label: string; value: string; trend?: 'up' | 'down' | 'flat' };
  /** AppView name the UI should navigate to when the user clicks. */
  actionView?: string;
  actionLabel?: string;
  /** Days until this recommendation becomes overdue / urgent. */
  dueInDays?: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Format a number as Indian Rupees with lakh/crore notation for large amounts.
 * Mirrors the formatINR helper in @/lib/ai-provider/knowledge — duplicated here
 * to keep the engine self-contained (no cross-module coupling).
 */
export function formatINR(amount: number): string {
  const abs = Math.abs(amount);
  if (abs >= 1_00_00_000) return `₹${(amount / 1_00_00_000).toFixed(2)} Cr`;
  if (abs >= 1_00_000) return `₹${(amount / 1_00_000).toFixed(2)} L`;
  if (abs >= 1_000) return `₹${(amount / 1_000).toFixed(1)}K`;
  return `₹${Math.round(amount).toLocaleString('en-IN')}`;
}

/**
 * Generate a stable id from a prefix + content hash (deterministic FNV-1a 32-bit).
 * Returns `rec-{type}-{base36hash}` — e.g. `rec-receivables-j7f2a1`.
 */
function makeId(type: RecommendationType, ...parts: (string | number)[]): string {
  const input = parts.join('|');
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `rec-${type}-${(hash >>> 0).toString(36)}`;
}

/**
 * Estimated monthly burn rate from the snapshot. The snapshot's `expenses` field
 * is the financial-year-to-date total, so we divide by the number of months
 * elapsed in the FY (minimum 1) to get an average monthly burn.
 */
function estimateMonthlyBurnRate(snapshot: BusinessSnapshot): number {
  if (snapshot.expenses <= 0) return 0;
  const now = new Date();
  const month = now.getMonth();
  const fyStartYear = month < 3 ? now.getFullYear() - 1 : now.getFullYear();
  const fyStart = new Date(fyStartYear, 3, 1); // April 1
  const monthsElapsed = Math.max(
    1,
    Math.round((now.getTime() - fyStart.getTime()) / (30 * 24 * 60 * 60 * 1000)),
  );
  return snapshot.expenses / monthsElapsed;
}

/**
 * Top risk factor label for the "High Risk Score" recommendation. Derives a
 * human-readable driver from the snapshot's worst-performing dimension.
 */
function topRiskFactor(snapshot: BusinessSnapshot): string {
  if (snapshot.cash < 0) return 'negative cash position';
  if (snapshot.overdueReturns > 0) return `${snapshot.overdueReturns} overdue GST return${snapshot.overdueReturns === 1 ? '' : 's'}`;
  if (snapshot.profit < 0) return 'operating at a loss';
  if (snapshot.payables > 0 && snapshot.cash / snapshot.payables < 1) {
    return 'cash does not cover payables';
  }
  if (snapshot.receivables > 0 && snapshot.revenue > 0 && snapshot.receivables / snapshot.revenue > 0.5) {
    return 'high receivables concentration';
  }
  return 'multiple contributing factors';
}

// ─── Pure rules engine ────────────────────────────────────────────────────────

/**
 * Generate recommendations from the Business Snapshot using deterministic pure
 * rules. Each rule fires ONLY when its condition is true. Returns an UNSORTED
 * array — the caller is responsible for sorting (see `sortRecommendations`).
 *
 * Rules implemented here (the ones that only need snapshot-level data):
 *   1. High Outstanding        — receivables > 0
 *   4. GST Filing Due          — pendingReturns > 0
 *   6. Cash Below Monthly Burn — cash < monthlyBurnRate AND burn > 0
 *   7. Low Health Score        — healthScore < 50
 *   8. High Risk Score         — riskScore > 60
 *  10. ITC Available           — itcAvailable > 0
 *
 * Rules that need Prisma row-level access (overdue-tomorrow invoices, revenue
 * drop, customer delays, top customer concentration) are exposed as separate
 * async functions below and merged by the /api/recommendations route.
 */
export function generateRecommendationsFromSnapshot(
  snapshot: BusinessSnapshot,
): Recommendation[] {
  const recs: Recommendation[] = [];
  const orgKey = snapshot.organizationId;

  // ── Rule 1: High Outstanding ───────────────────────────────────────────────
  if (snapshot.receivables > 0) {
    recs.push({
      id: makeId('receivables', orgKey, Math.round(snapshot.receivables)),
      type: 'receivables',
      priority: 'high',
      title: `Collect ${formatINR(snapshot.receivables)} outstanding`,
      description: `${snapshot.invoiceCount} invoice${snapshot.invoiceCount === 1 ? '' : 's'} on record, ${formatINR(snapshot.receivables)} pending collection.`,
      metric: {
        label: 'Outstanding',
        value: formatINR(snapshot.receivables),
        trend: 'flat',
      },
      actionView: 'invoices',
      actionLabel: 'View invoices',
    });
  }

  // ── Rule 4: GST Filing Due ─────────────────────────────────────────────────
  if (snapshot.pendingReturns > 0) {
    const isOverdue = snapshot.overdueReturns > 0;
    recs.push({
      id: makeId('compliance', orgKey, snapshot.pendingReturns, snapshot.overdueReturns),
      type: 'compliance',
      priority: isOverdue ? 'critical' : 'high',
      title: `GST filing due — ${snapshot.pendingReturns} return${snapshot.pendingReturns === 1 ? '' : 's'} pending`,
      description: isOverdue
        ? `${snapshot.overdueReturns} overdue — late filing attracts penalty + interest.`
        : 'File before the due date to avoid late fees and interest.',
      metric: {
        label: 'Pending returns',
        value: String(snapshot.pendingReturns),
      },
      actionView: 'returns',
      actionLabel: 'Open returns',
      dueInDays: isOverdue ? 0 : 5,
    });
  }

  // ── Rule 6: Cash Below Monthly Expenses ────────────────────────────────────
  const monthlyBurn = estimateMonthlyBurnRate(snapshot);
  if (monthlyBurn > 0 && snapshot.cash < monthlyBurn) {
    const runwayMonths = snapshot.cash > 0 ? snapshot.cash / monthlyBurn : 0;
    recs.push({
      id: makeId('cash', orgKey, Math.round(snapshot.cash), Math.round(monthlyBurn)),
      type: 'cash',
      priority: 'critical',
      title: 'Cash balance is below monthly expenses',
      description: `Cash ${formatINR(snapshot.cash)} vs monthly burn ${formatINR(monthlyBurn)} — runway ${runwayMonths.toFixed(1)} months.`,
      metric: {
        label: 'Runway',
        value: `${runwayMonths.toFixed(1)} mo`,
        trend: 'down',
      },
      actionView: 'banking',
      actionLabel: 'Review cash flow',
    });
  }

  // ── Rule 7: Low Health Score ───────────────────────────────────────────────
  if (snapshot.healthScore > 0 && snapshot.healthScore < 50) {
    recs.push({
      id: makeId('risk', orgKey, snapshot.healthScore),
      type: 'risk',
      priority: 'high',
      title: `Business health is ${snapshot.healthScore}/100 — needs attention`,
      description: 'Composite health score is below the safe threshold (50). Profitability, liquidity, compliance, and collections all contribute.',
      metric: {
        label: 'Health score',
        value: `${snapshot.healthScore}/100`,
        trend: 'down',
      },
      actionView: 'analytics',
      actionLabel: 'View analytics',
    });
  }

  // ── Rule 8: High Risk Score ────────────────────────────────────────────────
  if (snapshot.riskScore > 60) {
    const driver = topRiskFactor(snapshot);
    recs.push({
      id: makeId('risk', orgKey, snapshot.riskScore, 'elevated'),
      type: 'risk',
      priority: 'high',
      title: `Risk score elevated (${snapshot.riskScore}/100)`,
      description: `Driven by ${driver}. Address the underlying cause to bring risk below 60.`,
      metric: {
        label: 'Risk score',
        value: `${snapshot.riskScore}/100`,
        trend: 'up',
      },
      actionView: 'analytics',
      actionLabel: 'Investigate',
    });
  }

  // ── Rule 10: ITC Available ─────────────────────────────────────────────────
  if (snapshot.itcAvailable > 0) {
    recs.push({
      id: makeId('compliance', orgKey, Math.round(snapshot.itcAvailable), 'itc'),
      type: 'compliance',
      priority: 'low',
      title: `${formatINR(snapshot.itcAvailable)} Input Tax Credit available to claim`,
      description: 'Claim ITC against output tax liability to reduce net GST payable. Unclaimed ITC lapses after the deadline.',
      metric: {
        label: 'ITC available',
        value: formatINR(snapshot.itcAvailable),
      },
      actionView: 'returns',
      actionLabel: 'Open returns',
    });
  }

  return recs;
}

// ─── Async enrichment rules (require Prisma row-level access) ─────────────────

/** Result of the overdue-tomorrow invoice lookup. */
export interface OverdueTomorrowResult {
  count: number;
  totalAmount: number;
  invoiceNumbers: string[];
}

/**
 * Rule 2: Invoices that become overdue tomorrow.
 *
 * "Becoming overdue tomorrow" means the invoice's due date is TODAY — once
 * today ends, the invoice is overdue. We fetch unpaid invoices with a dueDate
 * and filter in JS because `dueDate` is stored as a String (ISO date), so
 * Prisma date comparisons are unreliable across mixed formats.
 */
export async function getOverdueTomorrowInvoices(
  organizationId: string,
): Promise<OverdueTomorrowResult> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const invoices = await db.invoice.findMany({
    where: {
      client: { firmId: organizationId },
      status: { not: 'paid' },
      dueDate: { not: null },
    },
    select: {
      id: true,
      invoiceNumber: true,
      dueDate: true,
      balanceAmount: true,
    },
  });

  const filtered = invoices.filter((inv) => {
    if (!inv.dueDate) return false;
    const due = new Date(inv.dueDate);
    if (Number.isNaN(due.getTime())) return false;
    return due >= today && due < tomorrow;
  });

  return {
    count: filtered.length,
    totalAmount: filtered.reduce((sum, i) => sum + (i.balanceAmount ?? 0), 0),
    invoiceNumbers: filtered.map((i) => i.invoiceNumber),
  };
}

/**
 * Build a Recommendation from the overdue-tomorrow lookup result. Returns null
 * if no invoices are becoming overdue tomorrow.
 */
export function buildOverdueTomorrowRecommendation(
  organizationId: string,
  result: OverdueTomorrowResult,
): Recommendation | null {
  if (result.count === 0) return null;
  return {
    id: makeId('receivables', organizationId, 'overdue-tomorrow', result.count),
    type: 'receivables',
    priority: 'critical',
    title: `${result.count} invoice${result.count === 1 ? '' : 's'} become${result.count === 1 ? 's' : ''} overdue tomorrow`,
    description: `Total value ${formatINR(result.totalAmount)}. Send reminders today to avoid late payment.`,
    metric: {
      label: 'Becoming overdue',
      value: String(result.count),
      trend: 'up',
    },
    actionView: 'invoices',
    actionLabel: 'View invoices',
    dueInDays: 1,
  };
}

/** Month-over-month revenue comparison result. */
export interface RevenueDropResult {
  dropPercent: number;
  thisMonth: number;
  lastMonth: number;
}

/**
 * Rule 3: Revenue dropped month-over-month.
 *
 * Compares the sum of `totalAmount` on invoices created THIS calendar month
 * vs LAST calendar month (using `createdAt` — a proper DateTime — for reliable
 * filtering). Returns null if last month had no revenue or revenue did not drop.
 *
 * Only fires when the drop exceeds 10%.
 */
export async function getRevenueDrop(
  organizationId: string,
): Promise<RevenueDropResult | null> {
  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const [thisMonthAgg, lastMonthAgg] = await Promise.all([
    db.invoice.aggregate({
      where: {
        client: { firmId: organizationId },
        createdAt: { gte: thisMonthStart, lt: nextMonthStart },
      },
      _sum: { totalAmount: true },
    }),
    db.invoice.aggregate({
      where: {
        client: { firmId: organizationId },
        createdAt: { gte: lastMonthStart, lt: thisMonthStart },
      },
      _sum: { totalAmount: true },
    }),
  ]);

  const thisMonth = thisMonthAgg._sum.totalAmount ?? 0;
  const lastMonth = lastMonthAgg._sum.totalAmount ?? 0;

  if (lastMonth <= 0) return null; // can't compute a meaningful drop
  const dropPercent = ((lastMonth - thisMonth) / lastMonth) * 100;
  if (dropPercent <= 10) return null; // not a significant drop

  return { dropPercent, thisMonth, lastMonth };
}

/**
 * Build a Recommendation from the revenue-drop lookup result.
 */
export function buildRevenueDropRecommendation(
  organizationId: string,
  result: RevenueDropResult,
): Recommendation {
  return {
    id: makeId('growth', organizationId, 'revenue-drop', Math.round(result.dropPercent)),
    type: 'growth',
    priority: 'high',
    title: `Revenue dropped ${result.dropPercent.toFixed(0)}%`,
    description: `${formatINR(result.thisMonth)} this month vs ${formatINR(result.lastMonth)} last month — investigate lost accounts, pricing, or seasonality.`,
    metric: {
      label: 'MoM change',
      value: `-${result.dropPercent.toFixed(0)}%`,
      trend: 'down',
    },
    actionView: 'analytics',
    actionLabel: 'View analytics',
  };
}

/** A customer who has paid invoices late more than 2 times. */
export interface CustomerDelayEntry {
  clientId: string;
  clientName: string;
  delayCount: number;
}

/**
 * Rule 5: Customers with >2 invoices paid late.
 *
 * "Paid late" = the invoice's `paymentDate` is AFTER its `dueDate`. Both fields
 * are stored as Strings (ISO date), so we fetch all paid invoices with both
 * dates set and filter/group in JS.
 */
export async function getCustomerDelays(
  organizationId: string,
): Promise<CustomerDelayEntry[]> {
  const invoices = await db.invoice.findMany({
    where: {
      client: { firmId: organizationId },
      paymentStatus: 'paid',
      paymentDate: { not: null },
      dueDate: { not: null },
    },
    select: {
      id: true,
      clientId: true,
      dueDate: true,
      paymentDate: true,
      client: { select: { id: true, tradeName: true, legalName: true } },
    },
  });

  const byClient = new Map<string, CustomerDelayEntry>();
  for (const inv of invoices) {
    if (!inv.dueDate || !inv.paymentDate) continue;
    const due = new Date(inv.dueDate);
    const paid = new Date(inv.paymentDate);
    if (Number.isNaN(due.getTime()) || Number.isNaN(paid.getTime())) continue;
    if (paid <= due) continue; // paid on time or early

    const clientName =
      inv.client?.tradeName || inv.client?.legalName || 'Unknown customer';
    const existing = byClient.get(inv.clientId);
    if (existing) {
      existing.delayCount += 1;
    } else {
      byClient.set(inv.clientId, {
        clientId: inv.clientId,
        clientName,
        delayCount: 1,
      });
    }
  }

  // Keep only customers with MORE THAN 2 late payments.
  return Array.from(byClient.values()).filter((c) => c.delayCount > 2);
}

/**
 * Build Recommendations (one per customer) from the customer-delay lookup.
 */
export function buildCustomerDelayRecommendations(
  organizationId: string,
  entries: CustomerDelayEntry[],
): Recommendation[] {
  return entries.map((entry) => ({
    id: makeId('customer', organizationId, entry.clientId, entry.delayCount),
    type: 'customer',
    priority: 'medium',
    title: `Customer ${entry.clientName} has delayed payment ${entry.delayCount} times`,
    description: 'Consider stricter payment terms (advance, shorter net), automated reminders, or revisiting credit limits.',
    metric: {
      label: 'Late payments',
      value: String(entry.delayCount),
      trend: 'up',
    },
    actionView: 'clients',
    actionLabel: 'Open customer',
  }));
}

/** Top customer concentration result. */
export interface TopCustomerConcentrationResult {
  clientId: string;
  clientName: string;
  revenue: number;
  share: number; // 0-100
}

/**
 * Rule 9: Top customer concentration.
 *
 * Groups invoices by `clientId`, finds the customer with the highest revenue
 * share. Fires only when the share exceeds 40%.
 */
export async function getTopCustomerConcentration(
  organizationId: string,
): Promise<TopCustomerConcentrationResult | null> {
  const grouped = await db.invoice.groupBy({
    by: ['clientId'],
    where: { client: { firmId: organizationId } },
    _sum: { totalAmount: true },
  });

  const total = grouped.reduce((sum, g) => sum + (g._sum.totalAmount ?? 0), 0);
  if (total <= 0) return null;

  const top = grouped
    .map((g) => ({ clientId: g.clientId, revenue: g._sum.totalAmount ?? 0 }))
    .sort((a, b) => b.revenue - a.revenue)[0];

  if (!top || top.revenue <= 0) return null;
  const share = (top.revenue / total) * 100;
  if (share <= 40) return null;

  const client = await db.client.findUnique({
    where: { id: top.clientId },
    select: { tradeName: true, legalName: true },
  });

  return {
    clientId: top.clientId,
    clientName: client?.tradeName || client?.legalName || 'Unknown customer',
    revenue: top.revenue,
    share,
  };
}

/**
 * Build a Recommendation from the top-customer-concentration lookup.
 */
export function buildTopCustomerConcentrationRecommendation(
  organizationId: string,
  result: TopCustomerConcentrationResult,
): Recommendation {
  return {
    id: makeId('customer', organizationId, 'concentration', result.clientId),
    type: 'customer',
    priority: 'medium',
    title: `Customer concentration risk — ${result.clientName} is ${result.share.toFixed(0)}% of revenue`,
    description: `${formatINR(result.revenue)} from a single customer. Diversify the customer base to reduce dependency risk.`,
    metric: {
      label: 'Revenue share',
      value: `${result.share.toFixed(0)}%`,
      trend: 'flat',
    },
    actionView: 'clients',
    actionLabel: 'Open customers',
  };
}

// ─── Sorting ──────────────────────────────────────────────────────────────────

const PRIORITY_RANK: Record<RecommendationPriority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

/**
 * Sort recommendations by priority (critical → high → medium → low), then by
 * dueInDays ascending (sooner first; undefined dueInDays sorts last within the
 * same priority bucket).
 */
export function sortRecommendations(recs: Recommendation[]): Recommendation[] {
  return [...recs].sort((a, b) => {
    const rankA = PRIORITY_RANK[a.priority] ?? 99;
    const rankB = PRIORITY_RANK[b.priority] ?? 99;
    if (rankA !== rankB) return rankA - rankB;
    const dueA = a.dueInDays ?? Number.MAX_SAFE_INTEGER;
    const dueB = b.dueInDays ?? Number.MAX_SAFE_INTEGER;
    return dueA - dueB;
  });
}
