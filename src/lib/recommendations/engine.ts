// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — AI Recommendations Engine
//
// Generates REAL strategic recommendations from the Business Snapshot (single
// source of truth) + targeted Prisma enrichment queries.
//
// DESIGN PRINCIPLE — NO DUPLICATES WITH THE DASHBOARD:
//   The dashboard already surfaces *actionable* items in the Action Center
//   (overdue invoices, pending collection, GST liability, reconciliation
//   issues, upcoming returns) and the *business health score* in the hero
//   pill. This engine MUST NOT re-emit those same items as recommendations —
//   doing so caused the user-reported "₹89.5K pending collection" + "9 invoices
//   unpaid" contradiction (the engine mislabeled `invoices.count` — total
//   invoices — as the unpaid count) and the "40 / 58 / Poor / Fair" multi-
//   health-score confusion (the engine emitted a "Business health is X/100"
//   rule that disagreed with the hero pill).
//
//   This engine therefore focuses on STRATEGIC advice only:
//     • Cash Below Monthly Expenses  — runway warning (strategic)
//     • High Risk Score              — elevated risk (strategic, distinct
//                                       from health score)
//     • ITC Available                — optimization opportunity (claim ITC)
//     • Overdue Tomorrow             — proactive warning (Prisma enrichment)
//     • Revenue Dropped              — trend alert (Prisma enrichment)
//     • Customer Payment Delays      — relationship risk (Prisma enrichment)
//     • Top Customer Concentration   — diversification advice (Prisma)
//
// Rules:
//   1. NEVER calculate revenue/cash/GST/health independently — always from snapshot.
//   2. Use Prisma ONLY for record-level enrichment (overdue-tomorrow invoices,
//      customer payment delays, top customer by revenue).
//   3. Do NOT emit rules that duplicate the Action Center or the hero pill —
//      the dashboard is the single surface for those.
//   4. Sort by priority (critical → high → medium → low) then dueInDays.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { getBusinessSnapshot } from '@/lib/business/snapshot';

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
  actionView?: string;
  actionLabel?: string;
  dueInDays?: number;
}

// ─── Indian currency formatting ───────────────────────────────────────────────

function formatIndian(amount: number): string {
  if (!Number.isFinite(amount) || amount === 0) return '₹0';
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  if (abs >= 10000000) return `${sign}₹${(abs / 10000000).toFixed(2)}Cr`;
  if (abs >= 100000) return `${sign}₹${(abs / 100000).toFixed(2)}L`;
  if (abs >= 1000) return `${sign}₹${(abs / 1000).toFixed(1)}K`;
  return `${sign}₹${Math.round(abs).toLocaleString('en-IN')}`;
}

function hashId(input: string): string {
  // Simple deterministic hash for recommendation IDs
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

// ─── Pure rules engine (from snapshot) ────────────────────────────────────────

/**
 * Generate recommendations from snapshot fields only.
 * Pure function — no Prisma access, no side effects.
 */
export function generateRecommendationsFromSnapshot(snapshot: {
  revenue?: number;
  expenses?: number;
  profit?: number;
  cash?: number;
  invoices?: { total?: number; outstanding?: number; overdue?: number; count?: number };
  receivables?: number;
  payables?: number;
  gst?: { outputTax?: number; inputTax?: number; netLiability?: number; itcAvailable?: number };
  healthScore?: number;
  riskScore?: number;
  runway?: { monthsRemaining?: number; monthlyBurnRate?: number; isProfitable?: boolean };
  filedReturns?: number;
  pendingReturns?: number;
  overdueReturns?: number;
}): Recommendation[] {
  const recs: Recommendation[] = [];

  // NOTE: The following dashboard-surface items are INTENTIONALLY NOT emitted
  // here (they belong to the Action Center or the hero pill, not strategic AI
  // recommendations):
  //
  //   • "Collect ₹X outstanding" — Action Center already shows
  //     "₹X pending collection" as an actionable item. Re-emitting it here
  //     caused the user-reported "9 invoices unpaid" contradiction (this
  //     engine was mislabeling `invoices.count` — total invoices — as the
  //     unpaid count). The Action Center uses the truthful outstanding ₹
  //     amount only.
  //
  //   • "GST filing due — N returns pending" — Action Center already shows
  //     "₹X GST liability pending" (net output tax − ITC) and the next
  //     upcoming/overdue return. The Oracle daily briefing additionally
  //     reports "GSTR-3B prepared — ready to file" when Oracle has drafted
  //     the return. Re-emitting it as a recommendation was redundant.
  //
  //   • "Business health is X/100 — needs attention" — the hero pill in the
  //     DashboardPage header already renders the canonical health score +
  //     label from `/api/business/snapshot`. Re-emitting it here caused the
  //     "40 / 58 / Poor / Fair" multi-score confusion (the engine fetched
  //     the snapshot at a different moment than the client, producing a
  //     different number that disagreed with the hero pill).

  // 1. Cash Below Monthly Expenses (strategic runway warning)
  const cash = snapshot.cash ?? 0;
  const monthlyBurn = snapshot.runway?.monthlyBurnRate ?? 0;
  const runwayMonths = snapshot.runway?.monthsRemaining ?? 0;
  if (monthlyBurn > 0 && cash < monthlyBurn && cash >= 0) {
    recs.push({
      id: `rec-cash-${hashId('cash-burn')}`,
      type: 'cash',
      priority: 'critical',
      title: 'Cash balance is below monthly expenses',
      description: `Cash ${formatIndian(cash)} vs monthly burn ${formatIndian(monthlyBurn)} — runway ${runwayMonths > 0 ? `${runwayMonths.toFixed(1)} months` : 'exhausted'}.`,
      metric: { label: 'Runway', value: `${runwayMonths.toFixed(1)} mo`, trend: 'down' },
      actionView: 'banking',
      actionLabel: 'View Banking',
    });
  }

  // 2. High Risk Score (strategic — distinct from the hero pill health score)
  // The risk score is a DIFFERENT metric from the health score (risk is
  // additive on triggered factors; health is a weighted composite). It is
  // NOT displayed in the dashboard header, so it's safe to surface here as
  // a strategic recommendation.
  const risk = snapshot.riskScore ?? 0;
  if (risk > 60) {
    recs.push({
      id: `rec-risk-${hashId('high-risk')}`,
      type: 'risk',
      priority: 'high',
      title: `Risk score elevated (${Math.round(risk)}/100)`,
      description: 'Elevated risk driven by overdue receivables, compliance gaps, or cash flow pressure. Review the risk factors in your snapshot.',
      metric: { label: 'Risk Score', value: `${Math.round(risk)}/100`, trend: 'up' },
      actionView: 'ai-business-copilot',
      actionLabel: 'Ask Oracle',
    });
  }

  // 3. ITC Available (strategic optimization — claimable input tax credit)
  const itc = snapshot.gst?.itcAvailable ?? 0;
  if (itc > 0) {
    recs.push({
      id: `rec-compliance-${hashId('itc')}`,
      type: 'compliance',
      priority: 'low',
      title: `${formatIndian(itc)} Input Tax Credit available to claim`,
      description: 'Claim ITC in your next GSTR-3B filing to reduce net GST liability.',
      metric: { label: 'ITC Available', value: formatIndian(itc) },
      actionView: 'returns',
      actionLabel: 'View Returns',
    });
  }

  return recs;
}

// ─── Enrichment queries (Prisma) ──────────────────────────────────────────────

/**
 * Invoices due tomorrow (not paid). Used for "2 invoices become overdue tomorrow".
 */
export async function getOverdueTomorrowInvoices(
  organizationId: string,
): Promise<{ count: number; totalAmount: number; invoiceNumbers: string[] }> {
  try {
    if (!organizationId || organizationId.startsWith('local-')) {
      return { count: 0, totalAmount: 0, invoiceNumbers: [] };
    }
    const startOfTomorrow = new Date();
    startOfTomorrow.setHours(24, 0, 0, 0); // midnight tonight
    const endOfTomorrow = new Date(startOfTomorrow);
    endOfTomorrow.setDate(endOfTomorrow.getDate() + 1);

    // dueDate is stored as ISO date string — query by string comparison
    const startStr = startOfTomorrow.toISOString().slice(0, 10);
    const endStr = endOfTomorrow.toISOString().slice(0, 10);

    const invoices = await db.invoice.findMany({
      where: {
        client: { firmId: organizationId },
        status: { not: 'paid' },
        dueDate: { gte: startStr, lt: endStr },
      },
      select: { invoiceNumber: true, totalAmount: true },
    });

    return {
      count: invoices.length,
      totalAmount: invoices.reduce((sum, inv) => sum + (inv.totalAmount ?? 0), 0),
      invoiceNumbers: invoices.map((i) => i.invoiceNumber),
    };
  } catch {
    return { count: 0, totalAmount: 0, invoiceNumbers: [] };
  }
}

/**
 * Customers with >2 invoices paid late (paidDate > dueDate).
 */
export async function getCustomersWithPaymentDelays(
  organizationId: string,
): Promise<Array<{ name: string; delayCount: number; clientId: string }>> {
  try {
    if (!organizationId || organizationId.startsWith('local-')) return [];

    // Find invoices that were paid late
    const lateInvoices = await db.invoice.findMany({
      where: {
        client: { firmId: organizationId },
        paymentStatus: 'paid',
        paymentDate: { not: null },
        dueDate: { not: null },
      },
      select: {
        clientId: true,
        buyerName: true,
        dueDate: true,
        paymentDate: true,
      },
    });

    // Group by customer, count delays
    const byCustomer = new Map<string, { name: string; delayCount: number }>();
    for (const inv of lateInvoices) {
      if (!inv.dueDate || !inv.paymentDate) continue;
      // Both are ISO date strings — compare lexically (works for YYYY-MM-DD)
      if (inv.paymentDate > inv.dueDate) {
        const key = inv.clientId;
        const existing = byCustomer.get(key);
        const name = inv.buyerName ?? 'Unknown Customer';
        if (existing) {
          existing.delayCount += 1;
        } else {
          byCustomer.set(key, { name, delayCount: 1 });
        }
      }
    }

    return Array.from(byCustomer.entries())
      .map(([clientId, val]) => ({ clientId, ...val }))
      .filter((c) => c.delayCount >= 3)
      .sort((a, b) => b.delayCount - a.delayCount)
      .slice(0, 5);
  } catch {
    return [];
  }
}

/**
 * Top customer by revenue (concentration risk if >40% of total).
 */
export async function getTopCustomerByRevenue(
  organizationId: string,
): Promise<{ name: string; revenue: number; revenueSharePct: number } | null> {
  try {
    if (!organizationId || organizationId.startsWith('local-')) return null;

    const grouped = await db.invoice.groupBy({
      by: ['clientId'],
      where: { client: { firmId: organizationId } },
      _sum: { totalAmount: true },
    });

    const total = grouped.reduce((sum, g) => sum + (g._sum.totalAmount ?? 0), 0);
    if (total === 0) return null;

    const top = grouped
      .sort((a, b) => (b._sum.totalAmount ?? 0) - (a._sum.totalAmount ?? 0))[0];
    if (!top) return null;

    const topRevenue = top._sum.totalAmount ?? 0;
    const share = (topRevenue / total) * 100;
    if (share < 40) return null; // only flag if concentration > 40%

    // Get the customer name
    const client = await db.client.findUnique({
      where: { id: top.clientId },
      select: { tradeName: true, legalName: true },
    });

    return {
      name: client?.tradeName ?? client?.legalName ?? 'Unknown Customer',
      revenue: topRevenue,
      revenueSharePct: share,
    };
  } catch {
    return null;
  }
}

/**
 * Compute revenue trend (this month vs last month).
 * Returns the percentage change (negative = drop).
 */
export async function getRevenueTrend(
  organizationId: string,
): Promise<{ thisMonth: number; lastMonth: number; changePct: number }> {
  try {
    if (!organizationId || organizationId.startsWith('local-')) {
      return { thisMonth: 0, lastMonth: 0, changePct: 0 };
    }

    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    const [thisMonthAgg, lastMonthAgg] = await Promise.all([
      db.invoice.aggregate({
        where: {
          client: { firmId: organizationId },
          createdAt: { gte: thisMonthStart },
        },
        _sum: { totalAmount: true },
      }),
      db.invoice.aggregate({
        where: {
          client: { firmId: organizationId },
          createdAt: { gte: lastMonthStart, lte: lastMonthEnd },
        },
        _sum: { totalAmount: true },
      }),
    ]);

    const thisMonth = thisMonthAgg._sum.totalAmount ?? 0;
    const lastMonth = lastMonthAgg._sum.totalAmount ?? 0;
    const changePct = lastMonth > 0 ? ((thisMonth - lastMonth) / lastMonth) * 100 : 0;

    return { thisMonth, lastMonth, changePct };
  } catch {
    return { thisMonth: 0, lastMonth: 0, changePct: 0 };
  }
}

// ─── Orchestrator ─────────────────────────────────────────────────────────────

const PRIORITY_ORDER: Record<RecommendationPriority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

/**
 * Generate the full recommendation list: snapshot-based rules + Prisma enrichment.
 * Sorted by priority (critical first), then dueInDays (sooner first).
 */
export async function generateRecommendations(
  organizationId: string,
): Promise<Recommendation[]> {
  if (!organizationId) return [];

  const snapshot = await getBusinessSnapshot(organizationId);
  const recs = generateRecommendationsFromSnapshot(snapshot);

  // ── Enrichment: 4 independent Prisma fetches run in parallel ──
  // (Was 4 sequential awaits — each ran only after the previous resolved.
  // Now they all fire at once via Promise.all, cutting 4 round-trips to 1.)
  const [overdueTomorrow, trend, slowCustomers, topCustomer] = await Promise.all([
    getOverdueTomorrowInvoices(organizationId),
    getRevenueTrend(organizationId),
    getCustomersWithPaymentDelays(organizationId),
    getTopCustomerByRevenue(organizationId),
  ]);

  // Enrichment: overdue-tomorrow
  if (overdueTomorrow.count > 0) {
    recs.push({
      id: `rec-receivables-${hashId('overdue-tomorrow')}`,
      type: 'receivables',
      priority: 'critical',
      title: `${overdueTomorrow.count} invoice${overdueTomorrow.count === 1 ? '' : 's'} become overdue tomorrow`,
      description: `Total value ${formatIndian(overdueTomorrow.totalAmount)}. Follow up today to avoid delays. Invoices: ${overdueTomorrow.invoiceNumbers.slice(0, 3).join(', ')}${overdueTomorrow.invoiceNumbers.length > 3 ? '…' : ''}`,
      metric: { label: 'Due Tomorrow', value: String(overdueTomorrow.count) },
      actionView: 'invoices',
      actionLabel: 'View Invoices',
      dueInDays: 1,
    });
  }

  // Enrichment: revenue dropped
  if (trend.lastMonth > 0 && trend.changePct < -10) {
    recs.push({
      id: `rec-growth-${hashId('revenue-drop')}`,
      type: 'growth',
      priority: 'high',
      title: `Revenue dropped ${Math.abs(trend.changePct).toFixed(1)}%`,
      description: `This month ${formatIndian(trend.thisMonth)} vs last month ${formatIndian(trend.lastMonth)}. Investigate causes — fewer invoices, lower ticket size, or customer churn.`,
      metric: { label: 'Revenue Change', value: `${trend.changePct.toFixed(1)}%`, trend: 'down' },
      actionView: 'analytics',
      actionLabel: 'View Analytics',
    });
  }

  // Enrichment: customer payment delays
  for (const c of slowCustomers) {
    recs.push({
      id: `rec-customer-${hashId(c.name + c.clientId)}`,
      type: 'customer',
      priority: 'medium',
      title: `Customer ${c.name} has delayed payment ${c.delayCount} times`,
      description: 'Consider tightening payment terms, requiring advance payments, or sending reminders earlier.',
      metric: { label: 'Late Payments', value: String(c.delayCount) },
      actionView: 'customers',
      actionLabel: 'View Customers',
    });
  }

  // Enrichment: top customer concentration
  if (topCustomer) {
    recs.push({
      id: `rec-customer-${hashId('concentration')}`,
      type: 'customer',
      priority: 'medium',
      title: `Customer concentration risk — ${topCustomer.name} is ${topCustomer.revenueSharePct.toFixed(0)}% of revenue`,
      description: `High dependency on a single customer. Diversify your customer base to reduce revenue risk.`,
      metric: { label: 'Concentration', value: `${topCustomer.revenueSharePct.toFixed(0)}%`, trend: 'flat' },
      actionView: 'customers',
      actionLabel: 'View Customers',
    });
  }

  // Sort: priority (critical first), then dueInDays (sooner first)
  return recs.sort((a, b) => {
    const pa = PRIORITY_ORDER[a.priority];
    const pb = PRIORITY_ORDER[b.priority];
    if (pa !== pb) return pa - pb;
    const da = a.dueInDays ?? 999;
    const db = b.dueInDays ?? 999;
    return da - db;
  });
}
