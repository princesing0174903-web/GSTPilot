// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT DIGITAL TWIN™ — LIVE KPI ENGINE™
//
// Continuously calculates 13 live KPIs from real connected business data:
//   Revenue, Profit, Cash, EBITDA, Runway, Burn Rate, Working Capital,
//   Customer Lifetime Value, Average Collection Time, Average Payment Time,
//   Vendor Reliability, Client Reliability, Business Growth %.
//
// HEADLINE FINANCIALS (revenue, profit, cash, runwayDays, burnRate,
// workingCapital) are sourced from the canonical Business Snapshot
// (`getBusinessSnapshot`) — the single source of truth across the entire app.
// Twin-specific KPIs (ebitda, CLV, collection/payment times, reliability
// scores, growth %) fall back to raw CFO data because the snapshot does not
// expose them.
//
// Refreshes automatically whenever business data changes.
// ═══════════════════════════════════════════════════════════════════════════════

import { fetchRawCFOData } from '@/lib/cfo/phase1/data';
import { computeRevenueAnalytics } from '@/lib/cfo/phase1/revenue-analytics';
import { computeProfitability } from '@/lib/cfo/phase1/profitability';
import { computeCashFlow } from '@/lib/cfo/phase1/cash-flow';
import { computeWorkingCapital as computeWorkingCapitalCFO } from '@/lib/cfo/phase1/working-capital';
import { computeCollections } from '@/lib/cfo/phase1/collection-engine';
import { getBusinessSnapshot } from '@/lib/business/snapshot';
import type { LiveKPIs } from './types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function safe<T>(fn: () => T): T {
  try { return fn(); } catch { return {} as T; }
}

// ─── Reliability scores ──────────────────────────────────────────────────────

function clientReliability(data: Parameters<typeof computeCollections>[0]): number {
  const collections = safe(() => computeCollections(data));
  // High collection efficiency + low overdue ratio = high reliability
  const efficiency = collections.collectionEfficiencyPct || 100;
  const overdueRatio = collections.totalOutstanding > 0
    ? (collections.overdueAmount / collections.totalOutstanding) * 100
    : 0;
  return Math.max(0, Math.min(100, Math.round(efficiency - overdueRatio)));
}

function vendorReliability(
  purchaseBills: Array<{ paymentStatus: string; vendorName: string }>,
): number {
  if (purchaseBills.length === 0) return 50;
  // Vendors with no overdue payments are reliable
  const byVendor = new Map<string, { total: number; overdue: number }>();
  for (const p of purchaseBills) {
    const v = (p.vendorName || 'unknown').toLowerCase();
    const cur = byVendor.get(v) || { total: 0, overdue: 0 };
    cur.total++;
    if (p.paymentStatus === 'overdue') cur.overdue++;
    byVendor.set(v, cur);
  }
  let totalReliability = 0;
  for (const [, { total, overdue }] of byVendor) {
    totalReliability += ((total - overdue) / total) * 100;
  }
  return Math.round(totalReliability / byVendor.size);
}

// ─── Average payment/collection times ────────────────────────────────────────

function averageCollectionTime(
  invoices: Array<{ invoiceDate: string; paymentDate: string | null; paymentStatus: string }>,
): number {
  const paid = invoices.filter((i) => i.paymentDate && (i.paymentStatus === 'paid' || i.paymentStatus === 'partial'));
  if (paid.length === 0) return 0;
  const totalDays = paid.reduce((s, i) => {
    const inv = new Date(i.invoiceDate).getTime();
    const pay = new Date(i.paymentDate!).getTime();
    return s + Math.max(0, (pay - inv) / (1000 * 60 * 60 * 24));
  }, 0);
  return Math.round(totalDays / paid.length);
}

function averagePaymentTime(
  purchaseBills: Array<{ invoiceDate: string; status: string; totalAmount: number; paidAmount: number }>,
  payments: Array<{ partyType: string; paymentDate: string }>,
): number {
  // Use vendor payments: approximate from payment dates vs purchase bill dates
  const vendorPayments = payments.filter((p) => p.partyType !== 'customer');
  if (vendorPayments.length === 0 || purchaseBills.length === 0) return 30; // default
  // Average days between earliest purchase bill date and payment date (rough proxy)
  const earliestPurchase = purchaseBills
    .map((p) => new Date(p.invoiceDate).getTime())
    .sort((a, b) => a - b)[0];
  const totalDays = vendorPayments.reduce((s, p) => {
    return s + Math.max(0, (new Date(p.paymentDate).getTime() - earliestPurchase) / (1000 * 60 * 60 * 24));
  }, 0);
  return Math.round(totalDays / vendorPayments.length);
}

// ─── Customer Lifetime Value ─────────────────────────────────────────────────

function customerLifetimeValue(
  revenue: { thisMonth: number },
  clients: Array<{ status: string }>,
  avgCollectionDays: number,
): number {
  const activeClients = clients.filter((c) => c.status === 'active').length;
  if (activeClients === 0) return 0;
  const monthlyRevenuePerClient = revenue.thisMonth / activeClients;
  // Assume average customer lifetime of 36 months (3 years) — adjusted by collection speed
  const lifetimeMonths = 36 * Math.min(1.5, Math.max(0.5, avgCollectionDays > 0 ? 45 / avgCollectionDays : 1));
  return Math.round(monthlyRevenuePerClient * lifetimeMonths);
}

// ─── Main: compute live KPIs ────────────────────────────────────────────────

export async function computeLiveKPIs(organizationId?: string): Promise<LiveKPIs> {
  // ── 1. Call the canonical Business Snapshot FIRST ──
  // Headline financials (revenue, profit, cash, runwayDays, burnRate,
  // workingCapital) come from the snapshot — the single source of truth.
  // Twin-specific KPIs (ebitda, CLV, reliability, growth %) fall back to raw
  // CFO data because the snapshot does not expose them.
  const orgId = organizationId ?? '';
  const snapshot = orgId
    ? await safe(() => getBusinessSnapshot(orgId))
    : null;

  // ── 2. Fetch raw data ONLY for twin-specific fields ──
  // ebitda, customerLifetimeValue, averageCollectionTime, averagePaymentTime,
  // vendorReliability, clientReliability, businessGrowthPct — none are in the
  // snapshot.
  const data = await fetchRawCFOData(orgId);

  const revenue = safe(() => computeRevenueAnalytics(data));
  const profitability = safe(() => computeProfitability(data));

  const avgCollectionDays = averageCollectionTime(data.invoices);
  const avgPaymentDays = averagePaymentTime(data.purchaseBills, data.payments);

  // ── 3. Headline financials from snapshot, with raw fallback ──
  // snapshot.revenueThisMonth preserves the MTD semantic the UI expects
  // (label "Revenue (MTD)"). snapshot.profit is the FY-total net profit.
  const snapshotRevenue = snapshot?.revenueThisMonth ?? revenue.thisMonth ?? 0;
  const snapshotProfit = snapshot?.profit ?? profitability.netProfit ?? 0;
  const snapshotCash = snapshot?.cash ?? safe(() => computeCashFlow(data)).currentCash ?? 0;
  const snapshotRunwayDays = snapshot?.runwayDays ?? safe(() => computeCashFlow(data)).runwayDays ?? 0;
  // burnRate: monthly operating burn — derived from snapshot.expenses (FY total / 12).
  // Falls back to the CFO cashFlow engine's burnRatePerMonth when no snapshot.
  const snapshotExpenses = snapshot?.expenses ?? 0;
  const snapshotBurnRate = snapshotExpenses > 0
    ? snapshotExpenses / 12
    : safe(() => computeCashFlow(data)).burnRatePerMonth ?? 0;
  const snapshotWorkingCapital = snapshot?.workingCapital
    ?? safe(() => computeWorkingCapitalCFO(data)).workingCapital ?? 0;

  // CLV uses MTD revenue per active client (twin-specific computation).
  const clv = customerLifetimeValue(
    { thisMonth: snapshotRevenue || revenue.thisMonth || 0 },
    data.clients,
    avgCollectionDays,
  );

  return {
    revenue: Math.round(snapshotRevenue),
    profit: Math.round(snapshotProfit),
    cash: Math.round(snapshotCash),
    ebitda: Math.round(profitability.ebitda || 0),
    runwayDays: Math.round(snapshotRunwayDays),
    burnRate: Math.round(snapshotBurnRate),
    workingCapital: Math.round(snapshotWorkingCapital),
    customerLifetimeValue: clv,
    averageCollectionTime: avgCollectionDays,
    averagePaymentTime: avgPaymentDays,
    vendorReliability: vendorReliability(data.purchaseBills),
    clientReliability: clientReliability(data),
    businessGrowthPct: Math.round((revenue.growthPct || 0) * 10) / 10,
    asOf: new Date().toISOString(),
  };
}
