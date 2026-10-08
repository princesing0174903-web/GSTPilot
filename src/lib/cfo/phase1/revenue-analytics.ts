// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO AI CFO™ Phase 1 — REVENUE ENGINE
//
// Real revenue analytics computed from connected Invoice data:
//   • Monthly / Quarterly / Yearly revenue with growth %
//   • Revenue by Client (top 10)
//   • Revenue by Industry (inferred from client state/entityType)
//   • Top Clients with trend
//   • Revenue Forecast (30d / 90d / Year End)
//   • 12-month sparkline
//
// No mock values — every number is computed from real Invoice rows.
// ═══════════════════════════════════════════════════════════════════════════════

import type { RevenueAnalytics, RevenueByClient, RevenueByIndustry } from '../types';
import type { RawCFOData, InvoiceRow, ClientRow } from './data';
import {
  now, startOfToday, startOfWeek, startOfMonth, startOfLastMonth, endOfLastMonth,
  startOfQuarter, startOfLastQuarter, endOfLastQuarter, startOfYear, startOfLastYear,
  endOfLastYear, addDays, monthLabel, quarterLabel, yearLabel, periodLabel,
  pctChange, trendFromPct, roundTo,
} from './data';

function revenueForRange(invoices: InvoiceRow[], from: Date, to: Date): number {
  return invoices
    .filter((i) => {
      const d = new Date(i.invoiceDate);
      return d >= from && d <= to;
    })
    .reduce((s, i) => s + (i.totalAmount || 0), 0);
}

function invoiceCountForRange(invoices: InvoiceRow[], from: Date, to: Date): number {
  return invoices.filter((i) => {
    const d = new Date(i.invoiceDate);
    return d >= from && d <= to;
  }).length;
}

// Build monthly breakdown — last 12 months
function buildMonthlyPeriods(invoices: InvoiceRow[]) {
  const monthly: Array<{ month: string; revenue: number; growthPct: number }> = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now().getFullYear(), now().getMonth() - i, 1);
    const start = new Date(d.getFullYear(), d.getMonth(), 1);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
    const rev = revenueForRange(invoices, start, end);
    const prev = monthly[monthly.length - 1]?.revenue ?? 0;
    monthly.push({
      month: monthLabel(d),
      revenue: Math.round(rev),
      growthPct: roundTo(pctChange(rev, prev), 1),
    });
  }
  return monthly;
}

// Build quarterly breakdown — last 8 quarters
function buildQuarterlyPeriods(invoices: InvoiceRow[]) {
  const quarterly: Array<{ quarter: string; revenue: number; growthPct: number }> = [];
  for (let i = 7; i >= 0; i--) {
    const ref = new Date(now().getFullYear(), now().getMonth() - i * 3, 1);
    const qMonth = Math.floor(ref.getMonth() / 3) * 3;
    const start = new Date(ref.getFullYear(), qMonth, 1);
    const end = new Date(ref.getFullYear(), qMonth + 3, 0, 23, 59, 59, 999);
    const rev = revenueForRange(invoices, start, end);
    const prev = quarterly[quarterly.length - 1]?.revenue ?? 0;
    quarterly.push({
      quarter: quarterLabel(start),
      revenue: Math.round(rev),
      growthPct: roundTo(pctChange(rev, prev), 1),
    });
  }
  return quarterly;
}

// Build yearly breakdown — last 3 years
function buildYearlyPeriods(invoices: InvoiceRow[]) {
  const yearly: Array<{ year: string; revenue: number; growthPct: number }> = [];
  for (let i = 2; i >= 0; i--) {
    const y = now().getFullYear() - i;
    const start = new Date(y, 0, 1);
    const end = new Date(y, 11, 31, 23, 59, 59, 999);
    const rev = revenueForRange(invoices, start, end);
    const prev = yearly[yearly.length - 1]?.revenue ?? 0;
    yearly.push({
      year: String(y),
      revenue: Math.round(rev),
      growthPct: roundTo(pctChange(rev, prev), 1),
    });
  }
  return yearly;
}

// Infer "industry" from client state + entityType (since we don't have a true
// industry field). For a real GST business, state acts as a useful segmentation
// proxy until industry data is connected.
function inferIndustry(client: ClientRow): string {
  if (client.stateCode && client.state) return `${client.state} (${client.stateCode})`;
  if (client.state) return client.state;
  if (client.entityType && client.entityType !== 'regular') return client.entityType;
  return 'Unspecified';
}

function buildByClient(invoices: InvoiceRow[], clients: ClientRow[]): RevenueByClient[] {
  const clientMap = new Map<string, ClientRow>();
  for (const c of clients) clientMap.set(c.id, c);

  const agg = new Map<string, { revenue: number; invoiceCount: number; gstin: string; name: string }>();
  for (const inv of invoices) {
    const client = clientMap.get(inv.clientId);
    const key = inv.clientId;
    const name = client?.tradeName || inv.buyerName || 'Unknown Client';
    const gstin = client?.gstin || inv.buyerGstin || '';
    const existing = agg.get(key) || { revenue: 0, invoiceCount: 0, gstin, name };
    existing.revenue += inv.totalAmount || 0;
    existing.invoiceCount += 1;
    agg.set(key, existing);
  }

  const totalRevenue = Array.from(agg.values()).reduce((s, v) => s + v.revenue, 0);

  // Compute trend per client: compare last 30d vs prior 30d
  const today = startOfToday();
  const last30Start = addDays(today, -30);
  const prior30Start = addDays(today, -60);
  const last30End = addDays(today, 1);
  const prior30End = addDays(today, -30);

  const rows: RevenueByClient[] = Array.from(agg.entries()).map(([clientId, v]) => {
    const clientInvs = invoices.filter((i) => i.clientId === clientId);
    const last30 = revenueForRange(clientInvs, last30Start, last30End);
    const prior30 = revenueForRange(clientInvs, prior30Start, prior30End);
    const growth = pctChange(last30, prior30);
    return {
      clientId,
      clientName: v.name,
      gstin: v.gstin,
      revenue: Math.round(v.revenue),
      invoiceCount: v.invoiceCount,
      sharePct: totalRevenue > 0 ? roundTo((v.revenue / totalRevenue) * 100, 1) : 0,
      trend: trendFromPct(growth),
    };
  });

  return rows.sort((a, b) => b.revenue - a.revenue).slice(0, 10);
}

function buildByIndustry(invoices: InvoiceRow[], clients: ClientRow[]): RevenueByIndustry[] {
  const clientMap = new Map<string, ClientRow>();
  for (const c of clients) clientMap.set(c.id, c);

  const agg = new Map<string, { revenue: number; clientCount: Set<string> }>();
  for (const inv of invoices) {
    const client = clientMap.get(inv.clientId);
    const industry = client ? inferIndustry(client) : 'Unspecified';
    const existing = agg.get(industry) || { revenue: 0, clientCount: new Set<string>() };
    existing.revenue += inv.totalAmount || 0;
    existing.clientCount.add(inv.clientId);
    agg.set(industry, existing);
  }

  const total = Array.from(agg.values()).reduce((s, v) => s + v.revenue, 0);

  return Array.from(agg.entries())
    .map(([industry, v]) => ({
      industry,
      revenue: Math.round(v.revenue),
      sharePct: total > 0 ? roundTo((v.revenue / total) * 100, 1) : 0,
      clientCount: v.clientCount.size,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);
}

function buildForecast(thisMonth: number, lastMonth: number, monthly: Array<{ revenue: number }>): { thirtyDay: number; ninetyDay: number; yearEnd: number } {
  // Forecast = trend-adjusted projection. If growth is positive, project continued
  // (dampened) growth. Negative growth projected with similar dampening.
  const recent = monthly.slice(-3).map((m) => m.revenue);
  const avgRecent = recent.length ? recent.reduce((a, b) => a + b, 0) / recent.length : thisMonth;
  const growthRate = lastMonth > 0 ? (thisMonth - lastMonth) / lastMonth : 0;
  const dampenedGrowth = growthRate * 0.5; // don't extrapolate fully

  // Daily run rate based on avgRecent month
  const dailyRate = avgRecent / 30;
  const thirtyDay = Math.round(dailyRate * 30 * (1 + dampenedGrowth));
  const ninetyDay = Math.round(dailyRate * 90 * (1 + dampenedGrowth * 0.7));
  // Year-end: months remaining * avgRecent
  const monthsRemaining = 12 - (now().getMonth() + 1);
  const yearEnd = Math.round((avgRecent * monthsRemaining) + thisMonth);

  return { thirtyDay, ninetyDay, yearEnd };
}

export function computeRevenueAnalytics(data: RawCFOData): RevenueAnalytics {
  const { invoices, clients } = data;

  const today = startOfToday();
  const tomorrow = addDays(today, 1);
  const weekStart = startOfWeek();
  const mStart = startOfMonth();
  const lmStart = startOfLastMonth();
  const lmEnd = endOfLastMonth();
  const qStart = startOfQuarter();
  const lqStart = startOfLastQuarter();
  const lqEnd = endOfLastQuarter();
  const yStart = startOfYear();
  const lyStart = startOfLastYear();
  const lyEnd = endOfLastYear();

  const todayRev = revenueForRange(invoices, today, tomorrow);
  const weekRev = revenueForRange(invoices, weekStart, tomorrow);
  const thisMonthRev = revenueForRange(invoices, mStart, tomorrow);
  const lastMonthRev = revenueForRange(invoices, lmStart, lmEnd);
  const thisQuarterRev = revenueForRange(invoices, qStart, tomorrow);
  const lastQuarterRev = revenueForRange(invoices, lqStart, lqEnd);
  const thisYearRev = revenueForRange(invoices, yStart, tomorrow);
  const lastYearRev = revenueForRange(invoices, lyStart, lyEnd);

  const growthPct = roundTo(pctChange(thisMonthRev, lastMonthRev), 1);
  const qoqGrowthPct = roundTo(pctChange(thisQuarterRev, lastQuarterRev), 1);
  const yoyGrowthPct = roundTo(pctChange(thisYearRev, lastYearRev), 1);

  const monthly = buildMonthlyPeriods(invoices);
  const quarterly = buildQuarterlyPeriods(invoices);
  const yearly = buildYearlyPeriods(invoices);

  const ytdRevenue = Math.round(thisYearRev);
  const ytdGrowthPct = yoyGrowthPct;

  const byClient = buildByClient(invoices, clients);
  const byIndustry = buildByIndustry(invoices, clients);

  const topClients = byClient.slice(0, 5).map((c) => ({
    name: c.clientName,
    revenue: c.revenue,
    sharePct: c.sharePct,
    trend: c.trend,
  }));

  const forecast = buildForecast(thisMonthRev, lastMonthRev, monthly);
  const sparkline = monthly.map((m) => m.revenue);

  return {
    today: Math.round(todayRev),
    thisWeek: Math.round(weekRev),
    thisMonth: Math.round(thisMonthRev),
    thisQuarter: Math.round(thisQuarterRev),
    thisYear: Math.round(thisYearRev),
    lastMonth: Math.round(lastMonthRev),
    growthPct,
    qoqGrowthPct,
    yoyGrowthPct,
    periods: { monthly, quarterly, yearly, ytdRevenue, ytdGrowthPct },
    byClient,
    byIndustry,
    topClients,
    trend: trendFromPct(growthPct),
    forecast,
    sparkline,
  };
}
