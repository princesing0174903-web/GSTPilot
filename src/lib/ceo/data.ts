// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT AI CEO™ — DATA FETCHER
//
// Single entry point for all AI CEO engines. Pulls the FULL CFO Phase 1 bundle
// + Digital Twin bundle in parallel, exposes a typed `CEODataView` that every
// engine reads from. Never touches Prisma directly — only reuses existing
// engines (no mock data, no duplication).
//
// Tagline: VEYRO AI CEO™ — Run Your Business. Not Your Software.
// ═══════════════════════════════════════════════════════════════════════════════

import { computeFinancialIntelligence } from '@/lib/cfo/phase1/orchestrator';
import { computeDigitalTwinBundle } from '@/lib/twin/orchestrator';
import { fetchRawCFOData } from '@/lib/cfo/phase1/data';
import type { FinancialIntelligenceBundle } from '@/lib/cfo/types';
import type { DigitalTwinBundle } from '@/lib/twin/types';
import type { RawCFOData } from '@/lib/cfo/phase1/data';
import type { CEOLiveState } from './types';

// ─── Safe wrapper (engine failures don't break AI CEO) ───────────────────────

function safe<T>(label: string, fn: () => Promise<T>, fallback: T): Promise<T> {
  return fn().catch((err) => {
    console.warn(`[AI CEO] Data source "${label}" failed:`, err);
    return fallback;
  });
}

// ─── Empty fallbacks (typed via `as` — only used on catastrophic failure) ────

const EMPTY_CFO = {
  executiveSummary: {
    headline: 'Connect GSTN, Bank, and Accounting to activate AI CEO.',
    healthScore: 0, healthTier: '—',
    revenueThisMonth: 0, revenueGrowthPct: 0,
    netProfit: 0, netMarginPct: 0,
    cashPosition: 0, runwayDays: 0, burnRatePerDay: 0,
    topRisk: 'No live data connected yet.',
    topOpportunity: 'Connect data sources to unlock AI CEO insights.',
    keyMetrics: [],
    generatedAt: new Date().toISOString(),
  },
  healthScore: {
    overall: 0, tier: 'critical',
    factors: [],
    summary: 'No live data yet.',
    topDriver: '—', topDrag: '—',
    asOfDate: new Date().toISOString(),
  },
  revenue: {
    today: 0, thisWeek: 0, thisMonth: 0, thisQuarter: 0, thisYear: 0,
    lastMonth: 0, growthPct: 0, qoqGrowthPct: 0, yoyGrowthPct: 0,
    periods: { monthly: [], quarterly: [], yearly: [], ytdRevenue: 0, ytdGrowthPct: 0 },
    byClient: [], byIndustry: [], topClients: [],
    trend: 'stable', forecast: { thirtyDay: 0, ninetyDay: 0, yearEnd: 0 },
    sparkline: [],
  },
  profitability: {
    revenue: 0, cogs: 0, grossProfit: 0, grossMarginPct: 0,
    opex: 0, operatingMarginPct: 0, ebitda: 0, ebitdaMarginPct: 0,
    netProfit: 0, netMarginPct: 0, expenseRatioPct: 0,
    monthlyTrends: [], customerProfitability: [], vendorCosts: [],
    trend: 'stable',
  },
  cashFlow: {
    currentCash: 0, availableCash: 0, burnRatePerDay: 0, burnRatePerMonth: 0,
    runwayDays: 0, runwayDate: null,
    inflowThisMonth: 0, outflowThisMonth: 0, netThisMonth: 0,
    projections: [], whyDecreasing: [], trend: 'stable',
  },
  workingCapital: {
    currentAssets: 0, currentLiabilities: 0, workingCapital: 0,
    workingCapitalRatio: 0, quickRatio: 0,
    liquidityRisk: 'low', liquidityRiskReason: 'No live data yet.',
    accountsReceivable: 0, accountsPayable: 0, inventoryValue: 0,
    prepaidExpenses: 0, shortTermDebt: 0,
    trend: 'stable',
  },
  expenses: {
    totalThisMonth: 0, totalLastMonth: 0, momChangePct: 0, avgMonthly: 0,
    byCategory: [], monthlyTrends: [], topVendors: [],
    recurringExpenses: 0, oneTimeExpenses: 0, trend: 'stable',
  },
  collections: {
    totalOutstanding: 0, overdueAmount: 0, overdueCount: 0,
    expectedCollections30d: 0, averageDaysToPay: 0, collectionEfficiencyPct: 0,
    badDebtReserve: 0, latePayments: [], riskyClients: [],
    recoveryStrategy: [], trend: 'stable',
  },
  gst: {
    outputLiability: 0, inputTaxCredit: 0, netGSTPayable: 0, itcUtilizationPct: 0,
    pendingFilings: 0, overdueFilings: 0, upcomingDueDates: [],
    itcAtRisk: 0, itcReversalRisk: 0, filingHistory: [],
  },
  forecast: {
    rows: [], overallConfidencePct: 0,
    methodology: 'Trend extrapolation with confidence scoring.',
    generatedAt: new Date().toISOString(),
  },
  risks: {
    risks: [], overallRiskLevel: 'low', overallRiskScore: 0,
    criticalCount: 0, highCount: 0,
    generatedAt: new Date().toISOString(),
  },
  recommendations: {
    recommendations: [], totalImpactValue: 0, criticalCount: 0,
    generatedAt: new Date().toISOString(),
  },
  generatedAt: new Date().toISOString(),
  hasLiveData: false, dataSources: [],
  clientCount: 0, invoiceCount: 0,
  tagline: 'VEYRO AI CFO™ — Every business deserves a world-class CFO.',
} as unknown as FinancialIntelligenceBundle;

const EMPTY_TWIN = {
  state: {
    revenue: 0, profit: 0, cash: 0, workingCapital: 0, gstPosition: 0, itc: 0,
    employees: 0, payroll: 0, collections: 0, receivables: 0, payables: 0,
    expenses: 0, inventory: 0, assets: 0, loans: 0, bankAccounts: [],
    clients: 0, vendors: 0, healthScore: 0, riskScore: 0, compliance: 0,
    forecast: { revenue30d: 0, cash30d: 0, profit30d: 0, gstLiabilityNext: 0, confidencePct: 0 },
    asOf: new Date().toISOString(), hasLiveData: false, dataSources: [],
  },
  timeline: { events: [], totalCount: 0, todayCount: 0, asOf: new Date().toISOString() },
  snapshots: {
    daily: [], weekly: [], monthly: [], quarterly: [], yearly: [],
    comparisons: {
      todayVsYesterday: { current: {} as never, previous: null, deltas: [], summary: 'No data' },
      thisMonthVsLastMonth: { current: {} as never, previous: null, deltas: [], summary: 'No data' },
      thisYearVsLastYear: { current: {} as never, previous: null, deltas: [], summary: 'No data' },
    },
    asOf: new Date().toISOString(),
  },
  kpis: {
    revenue: 0, profit: 0, cash: 0, ebitda: 0, runwayDays: 0, burnRate: 0,
    workingCapital: 0, customerLifetimeValue: 0, averageCollectionTime: 0,
    averagePaymentTime: 0, vendorReliability: 0, clientReliability: 0,
    businessGrowthPct: 0, asOf: new Date().toISOString(),
  },
  anomalies: {
    anomalies: [], totalCount: 0, criticalCount: 0, highCount: 0,
    asOf: new Date().toISOString(), scannedMetrics: [],
  },
  forecast: {
    revenue: { sevenDay: 0, thirtyDay: 0, ninetyDay: 0, yearEnd: 0, confidencePct: 0 },
    cashFlow: { sevenDay: 0, thirtyDay: 0, ninetyDay: 0, yearEnd: 0, confidencePct: 0 },
    profit: { sevenDay: 0, thirtyDay: 0, ninetyDay: 0, yearEnd: 0, confidencePct: 0 },
    gstLiability: { nextFiling: 0, next30d: 0, confidencePct: 0 },
    expenses: { thirtyDay: 0, ninetyDay: 0, confidencePct: 0 },
    collections: { thirtyDay: 0, ninetyDay: 0, confidencePct: 0 },
    overallConfidencePct: 0, generatedAt: new Date().toISOString(),
  },
  generatedAt: new Date().toISOString(),
  hasLiveData: false, dataSources: [],
  tagline: '',
} as unknown as DigitalTwinBundle;

const EMPTY_RAW: RawCFOData = {
  invoices: [], expenses: [], payments: [], purchaseBills: [], clients: [],
  filings: [], notices: [], employees: [], syncedRecords: [], dataConnections: [],
  fetchedAt: new Date().toISOString(), hasLiveData: false, dataSources: [],
};

// ─── CEO Data View — what every AI CEO engine reads ──────────────────────────

export interface CEODataView {
  cfo: FinancialIntelligenceBundle;
  twin: DigitalTwinBundle;
  raw: RawCFOData;
  liveState: CEOLiveState;
  hasLiveData: boolean;
  dataSources: string[];
  fetchedAt: string;
}

// ─── Live state builder (merges CFO + Twin into one CEO-grade view) ───────────

function buildLiveState(
  cfo: FinancialIntelligenceBundle,
  twin: DigitalTwinBundle,
  raw: RawCFOData,
): CEOLiveState {
  const bankBalance = twin.state.bankAccounts.reduce((s, b) => s + (b.balance || 0), 0);
  const cash = cfo.cashFlow.currentCash || bankBalance || twin.state.cash || 0;

  return {
    revenue: cfo.revenue.thisMonth || twin.state.revenue || 0,
    profit: cfo.profitability.netProfit || twin.state.profit || 0,
    cash,
    workingCapital: cfo.workingCapital.workingCapital || twin.state.workingCapital || 0,
    gstPayable: cfo.gst.netGSTPayable || twin.state.gstPosition || 0,
    itc: cfo.gst.inputTaxCredit || twin.state.itc || 0,
    receivables: cfo.collections.totalOutstanding || twin.state.receivables || 0,
    payables: twin.state.payables || 0,
    expenses: cfo.expenses.totalThisMonth || twin.state.expenses || 0,
    payroll: twin.state.payroll || 0,
    employees: twin.state.employees || raw.employees.length || 0,
    clients: twin.state.clients || cfo.clientCount || raw.clients.length || 0,
    vendors: twin.state.vendors || 0,
    healthScore: cfo.healthScore.overall || twin.state.healthScore || 0,
    riskScore: cfo.risks.overallRiskScore || twin.state.riskScore || 0,
    compliance: twin.state.compliance || 0,
    runwayDays: cfo.cashFlow.runwayDays || twin.kpis.runwayDays || 0,
    burnRate: cfo.cashFlow.burnRatePerMonth || twin.kpis.burnRate || 0,
    forecastRevenue30d: cfo.forecast.rows.find((r) => r.metric === 'revenue')?.thirtyDay || twin.forecast.revenue.thirtyDay || 0,
    forecastCash30d: cfo.forecast.rows.find((r) => r.metric === 'cash_flow')?.thirtyDay || twin.forecast.cashFlow.thirtyDay || 0,
    forecastConfidencePct: cfo.forecast.overallConfidencePct || twin.forecast.overallConfidencePct || 0,
  };
}

// ─── Main fetcher ────────────────────────────────────────────────────────────

/**
 * Fetch the CEO data view (CFO Phase 1 + Digital Twin + RawCFOData + live state).
 *
 * @param organizationId The org/firm id from OrgContext. When provided, every
 *   downstream engine (CFO Phase 1, Digital Twin, RawCFOData) is tenant-scoped
 *   AND the canonical Business Snapshot is fetched in parallel so the headline
 *   aggregates (revenue / cash / profit / GST / healthScore / riskScore) come
 *   from the single source of truth. When omitted (legacy callers), each
 *   engine returns an empty bundle — never leaks cross-tenant data.
 *
 *   See AUDIT-DUP-1 + task DUP-CLEANUP in worklog.md.
 */
export async function fetchCEOData(organizationId?: string): Promise<CEODataView> {
  const [cfo, twin, raw] = await Promise.all([
    safe('cfo-phase1', () => computeFinancialIntelligence(organizationId), EMPTY_CFO),
    safe('digital-twin', () => computeDigitalTwinBundle(), EMPTY_TWIN),
    safe('raw-cfo-data', () => fetchRawCFOData(organizationId ?? ''), EMPTY_RAW),
  ]);

  const hasLiveData = cfo.hasLiveData || twin.hasLiveData || raw.hasLiveData;
  const dataSources = Array.from(new Set([
    ...cfo.dataSources, ...twin.dataSources, ...raw.dataSources,
  ])).filter(Boolean);

  const liveState = buildLiveState(cfo, twin, raw);

  return {
    cfo, twin, raw, liveState,
    hasLiveData,
    dataSources,
    fetchedAt: new Date().toISOString(),
  };
}

// ─── Helper formatters used across CEO engines ───────────────────────────────

export function formatINR(n: number): string {
  if (!isFinite(n) || isNaN(n)) return '₹0';
  const abs = Math.abs(n);
  if (abs >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
  if (abs >= 100000) return `₹${(n / 100000).toFixed(2)} L`;
  if (abs >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return '₹' + Math.round(n).toLocaleString('en-IN');
}

export function formatINRFull(n: number): string {
  if (!isFinite(n) || isNaN(n)) return '₹0';
  return '₹' + Math.round(n).toLocaleString('en-IN');
}

export function formatPct(p: number, decimals = 1): string {
  const sign = p > 0 ? '+' : '';
  return `${sign}${p.toFixed(decimals)}%`;
}

export function formatDays(d: number): string {
  if (d <= 0) return 'today';
  if (d < 30) return `${d}d`;
  if (d < 365) return `${Math.round(d / 30 * 10) / 10}mo`;
  return `${(d / 365).toFixed(1)}y`;
}

export function inrShort(n: number): string {
  return formatINR(n);
}
