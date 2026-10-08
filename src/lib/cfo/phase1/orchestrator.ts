// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO AI CFO™ Phase 1 — FINANCIAL INTELLIGENCE ORCHESTRATOR
//
// Combines all Phase 1 engines into a single FinancialIntelligenceBundle:
//   • fetchRawCFOData → all connected business data from Prisma
//   • computeRevenueAnalytics → Revenue Engine
//   • computeProfitability → Profitability Engine
//   • computeCashFlow → Cash Flow Engine
//   • computeWorkingCapital → Working Capital Engine
//   • computeExpenses → Expense Engine
//   • computeCollections → Collection Engine
//   • computeForecast → Forecast Engine
//   • computeRiskEngine → Business Risk Engine
//   • computeHealthScore → Real Financial Health Score (0-100)
//   • computeRecommendations → AI CFO Recommendations
//
// Pure server-side TypeScript. Never throws — on any engine failure, returns
// a partial bundle with sensible empty states so the API never breaks.
//
// Tagline: VEYRO AI CFO™ — Every business deserves a world-class CFO.
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  FinancialIntelligenceBundle,
  ExecutiveSummary,
  GSTPositionAnalytics,
  RevenueAnalytics,
  ProfitabilityAnalytics,
  CashFlowAnalytics,
  WorkingCapitalAnalytics,
  ExpenseAnalytics,
  CollectionAnalytics,
  ForecastAnalytics,
  BusinessRiskEngine,
  RealFinancialHealthScore,
  AIRecommendations,
  SeverityLevel,
} from '../types';
import { fetchRawCFOData, type RawCFOData } from './data';
import { computeRevenueAnalytics } from './revenue-analytics';
import { computeProfitability } from './profitability';
import { computeCashFlow } from './cash-flow';
import { computeWorkingCapital } from './working-capital';
import { computeExpenses } from './expense-engine';
import { computeCollections } from './collection-engine';
import { computeForecast } from './forecast-engine';
import { computeRiskEngine } from './risk-engine';
import { computeHealthScore } from './health-score';
import { computeRecommendations } from './recommendations';
import { filingDueDate } from './data';

const TAGLINE = 'VEYRO AI CFO™ — Every business deserves a world-class CFO.';

// ─── GST Position (computed inline — small enough to not warrant its own file) ─
function computeGSTPosition(data: RawCFOData): GSTPositionAnalytics {
  const today = new Date();
  const mStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

  // Output liability this month
  const outputLiability = data.invoices
    .filter((i) => { const d = new Date(i.invoiceDate); return d >= mStart && d <= tomorrow; })
    .reduce((s, i) => s + (i.cgst || 0) + (i.sgst || 0) + (i.igst || 0) + (i.cess || 0), 0);

  // ITC available from purchase bills
  const inputTaxCredit = data.purchaseBills
    .reduce((s, p) => s + (p.gstAmount || (p.cgst + p.sgst + p.igst + p.cess)), 0);

  const netGSTPayable = Math.max(outputLiability - inputTaxCredit, 0);
  const itcUtilizationPct = inputTaxCredit > 0 ? Math.round(Math.min((outputLiability / inputTaxCredit) * 100, 100)) : 0;

  // Pending + overdue filings
  const pendingFilings = data.filings.filter((f) => f.status !== 'filed').length;
  const overdueFilings = data.filings.filter((f) => {
    if (f.status === 'filed') return false;
    const due = filingDueDate(f.returnType, f.period);
    return due ? due < today : false;
  }).length;

  // Upcoming due dates (next 60 days)
  const next60 = new Date(today.getTime() + 60 * 24 * 60 * 60 * 1000);
  const upcomingDueDates = data.filings
    .filter((f) => {
      if (f.status === 'filed') return false;
      const due = filingDueDate(f.returnType, f.period);
      return due ? due >= today && due <= next60 : false;
    })
    .map((f) => {
      const due = filingDueDate(f.returnType, f.period)!;
      return {
        returnType: f.returnType,
        period: f.period,
        dueDate: due.toISOString().split('T')[0],
        daysLeft: Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)),
        liability: f.totalTax || 0,
      };
    })
    .sort((a, b) => a.daysLeft - b.daysLeft)
    .slice(0, 5);

  // ITC at risk (older than 180 days, not yet claimed)
  const itcAtRisk = data.purchaseBills
    .filter((p) => {
      const age = (today.getTime() - new Date(p.invoiceDate).getTime()) / (1000 * 60 * 60 * 24);
      return age > 180 && p.paymentStatus !== 'paid';
    })
    .reduce((s, p) => s + (p.gstAmount || (p.cgst + p.sgst + p.igst + p.cess)), 0);

  // ITC reversal risk (rule 37 — vendor invoices where vendor GSTR-1 not matched,
  // i.e. vendorGstin missing OR invoice is unmatched in reconciliation)
  const itcReversalRisk = data.purchaseBills
    .filter((p) => !p.vendorGstin || p.paymentStatus === 'overdue')
    .reduce((s, p) => s + (p.gstAmount || (p.cgst + p.sgst + p.igst + p.cess)), 0) * 0.1; // estimate 10% reversal

  // Filing history (last 6 months)
  const filingHistory: Array<{ period: string; filed: boolean; onTime: boolean; liability: number }> = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const period = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const periodFilings = data.filings.filter((f) => f.period === period);
    if (periodFilings.length === 0) {
      filingHistory.push({ period, filed: false, onTime: false, liability: 0 });
    } else {
      const f = periodFilings[0];
      const filed = f.status === 'filed';
      const onTime = filed && f.filedDate ? new Date(f.filedDate) <= (filingDueDate(f.returnType, f.period) || today) : false;
      filingHistory.push({ period, filed, onTime, liability: f.totalTax || 0 });
    }
  }

  return {
    outputLiability: Math.round(outputLiability),
    inputTaxCredit: Math.round(inputTaxCredit),
    netGSTPayable: Math.round(netGSTPayable),
    itcUtilizationPct,
    pendingFilings,
    overdueFilings,
    upcomingDueDates,
    itcAtRisk: Math.round(itcAtRisk),
    itcReversalRisk: Math.round(itcReversalRisk),
    filingHistory,
  };
}

// ─── Executive Summary (derived from other engines) ──────────────────────────
function buildExecutiveSummary(
  data: RawCFOData,
  revenue: RevenueAnalytics,
  profitability: ProfitabilityAnalytics,
  cashFlow: CashFlowAnalytics,
  healthScore: RealFinancialHealthScore,
  risks: BusinessRiskEngine,
  recommendations: AIRecommendations,
): ExecutiveSummary {
  const topRisk = risks.risks[0];
  const topRec = recommendations.recommendations[0];
  const topOpportunity = recommendations.recommendations.find((r) => r.priority !== 'critical') || topRec;

  const headline = `${healthScore.tier === 'excellent' ? 'Excellent' : healthScore.tier === 'healthy' ? 'Healthy' : healthScore.tier === 'attention' ? 'Needs attention' : healthScore.tier === 'at_risk' ? 'At risk' : 'Critical'} — Health Score ${healthScore.overall}/100. Revenue ${revenue.growthPct >= 0 ? 'grew' : 'declined'} ${Math.abs(revenue.growthPct).toFixed(1)}% MoM. ${cashFlow.runwayDays > 0 ? `${cashFlow.runwayDays} days cash runway.` : 'Strong cash position.'}`;

  const keyMetrics = [
    { label: 'Revenue (MTD)', value: `₹${Math.round(revenue.thisMonth).toLocaleString('en-IN')}`, trend: revenue.trend },
    { label: 'Net Profit', value: `₹${Math.round(profitability.netProfit).toLocaleString('en-IN')}`, trend: profitability.trend },
    { label: 'Net Margin', value: `${profitability.netMarginPct}%` },
    { label: 'Cash Position', value: `₹${Math.round(cashFlow.currentCash).toLocaleString('en-IN')}`, trend: cashFlow.trend },
    { label: 'Runway', value: cashFlow.runwayDays > 0 ? `${cashFlow.runwayDays} days` : '> 1 year' },
    { label: 'Daily Burn', value: `₹${cashFlow.burnRatePerDay.toLocaleString('en-IN')}` },
    { label: 'Risk Level', value: risks.overallRiskLevel.toUpperCase() },
    { label: 'Active Risks', value: String(risks.risks.filter((r) => r.severity === 'critical' || r.severity === 'high').length) },
  ];

  return {
    headline,
    healthScore: healthScore.overall,
    healthTier: healthScore.tier,
    revenueThisMonth: Math.round(revenue.thisMonth),
    revenueGrowthPct: revenue.growthPct,
    netProfit: Math.round(profitability.netProfit),
    netMarginPct: profitability.netMarginPct,
    cashPosition: Math.round(cashFlow.currentCash),
    runwayDays: cashFlow.runwayDays,
    burnRatePerDay: cashFlow.burnRatePerDay,
    topRisk: topRisk ? `${topRisk.label}: ${topRisk.current}` : 'No critical risks detected',
    topOpportunity: topOpportunity ? `${topOpportunity.title} (${topOpportunity.financialImpact})` : 'No active opportunities',
    keyMetrics,
    generatedAt: new Date().toISOString(),
  };
}

// ─── Safe-wrapping helpers (engine failures don't break the bundle) ──────────
function safe<T>(label: string, fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch (err) {
    console.warn(`[AI CFO Phase 1] Engine "${label}" failed:`, err);
    return fallback;
  }
}

async function safeAsync<T>(label: string, fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    console.warn(`[AI CFO Phase 1] Engine "${label}" failed:`, err);
    return fallback;
  }
}

// ─── Main orchestrator (TENANT-SCOPED) ────────────────────────────────────────

/**
 * Compute the full Financial Intelligence bundle for a SINGLE organization.
 *
 * 🔒 SECURITY: `organizationId` is REQUIRED. An empty string returns a valid
 * but empty bundle (never global/cross-tenant data). Every downstream engine
 * (revenue, profitability, cash flow, risk, health, recommendations) operates
 * ONLY on the tenant-scoped RawCFOData returned by fetchRawCFOData.
 *
 * 🎯 CANONICAL DELEGATION: When `organizationId` is provided, the canonical
 * Business Snapshot (`getBusinessSnapshot(orgId)`) is fetched in parallel and
 * its headline aggregates OVERRIDE the bundle's headline numbers — so every
 * consumer of Phase 1 (Oracle chat, /api/ai-cfo/intelligence, ceo/data.ts,
 * autonomous/self-healing.ts) sees the exact same Revenue / Cash / Profit /
 * GST / Health Score / Risk Score as the Home Dashboard. The Phase 1 record-
 * level detail (top clients, by-category breakdown, monthly trends, late
 * payments, recovery strategy, filing history) still comes from the
 * org-scoped RawCFOData — the snapshot doesn't expose those breakdowns.
 *
 * @param organizationId The org/firm id from OrgContext. REQUIRED for any data.
 *   For backward compat, an empty/undefined value returns an empty bundle
 *   (legacy callers were silently broken; this preserves that behavior
 *   without leaking cross-tenant data).
 */
export async function computeFinancialIntelligence(
  organizationId?: string,
): Promise<FinancialIntelligenceBundle> {
  // 🔒 Hard tenant gate: no orgId → no data. Never fall through to a global query.
  if (!organizationId) {
    return emptyBundle();
  }

  // Fetch RawCFOData + the canonical Business Snapshot in parallel.
  const [data, snapshot] = await Promise.all([
    safeAsync('fetchRawCFOData', () => fetchRawCFOData(organizationId), {
      invoices: [], expenses: [], payments: [], purchaseBills: [], clients: [],
      filings: [], notices: [], employees: [], syncedRecords: [], dataConnections: [],
      fetchedAt: new Date().toISOString(), hasLiveData: false, dataSources: [],
    }),
    safeAsync('getBusinessSnapshot', async () => {
      const { getBusinessSnapshot } = await import('@/lib/business/snapshot');
      return await getBusinessSnapshot(organizationId);
    }, null),
  ]);

  // Compute independent engines in parallel-safe sequence
  const revenue = safe('revenue', () => computeRevenueAnalytics(data), emptyRevenue());
  const profitability = safe('profitability', () => computeProfitability(data), emptyProfitability());
  const cashFlow = safe('cashFlow', () => computeCashFlow(data), emptyCashFlow());
  const workingCapital = safe('workingCapital', () => computeWorkingCapital(data), emptyWorkingCapital());
  const expenses = safe('expenses', () => computeExpenses(data), emptyExpenses());
  const collections = safe('collections', () => computeCollections(data), emptyCollections());
  const forecast = safe('forecast', () => computeForecast(data), emptyForecast());
  const gst = safe('gst', () => computeGSTPosition(data), emptyGST());

  // Risk + Health + Recommendations depend on the above
  const risks = safe('risks', () => computeRiskEngine(data, { revenue, cashFlow, workingCapital, profitability }), emptyRisks());
  const healthScore = safe('healthScore', () => computeHealthScore(data, { revenue, profitability, cashFlow, workingCapital, collections }), emptyHealth());
  const recommendations = safe('recommendations', () => computeRecommendations(data, { revenue, profitability, cashFlow, workingCapital, collections, forecast, risks }), { recommendations: [], totalImpactValue: 0, criticalCount: 0, generatedAt: new Date().toISOString() });

  const executiveSummary = safe('executiveSummary', () => buildExecutiveSummary(data, revenue, profitability, cashFlow, healthScore, risks, recommendations), emptyExec());

  // ── Override headline aggregates with the canonical Business Snapshot ──
  // The snapshot is the single source of truth. The local engines still run
  // for record-level detail (top clients, monthly trends, late payments,
  // recovery strategy, filing history) that the snapshot doesn't expose.
  // Only override when the snapshot has real data — otherwise we'd clobber
  // legacy heuristic values with zeros.
  if (snapshot && (snapshot.healthScore > 0 || snapshot.revenue > 0 || snapshot.cash > 0 || snapshot.receivables > 0)) {
    if (snapshot.revenueThisMonth > 0) revenue.thisMonth = snapshot.revenueThisMonth;
    if (snapshot.revenueLastMonth > 0) revenue.lastMonth = snapshot.revenueLastMonth;
    if (snapshot.revenue > 0) revenue.thisYear = snapshot.revenue;
    if (revenue.lastMonth > 0) {
      revenue.growthPct = Math.round(((revenue.thisMonth - revenue.lastMonth) / revenue.lastMonth) * 1000) / 10;
    }

    profitability.netProfit = snapshot.profit;
    profitability.netMarginPct = Math.round(snapshot.profitMargin * 1000) / 10;
    profitability.revenue = snapshot.revenue;

    cashFlow.currentCash = snapshot.cash;
    cashFlow.availableCash = snapshot.cash;
    if (Number.isFinite(snapshot.runwayDays) && snapshot.runwayDays > 0) {
      cashFlow.runwayDays = Math.round(snapshot.runwayDays);
    }

    workingCapital.accountsReceivable = snapshot.receivables;
    workingCapital.accountsPayable = snapshot.payables;
    workingCapital.workingCapital = snapshot.receivables - snapshot.payables;

    collections.totalOutstanding = snapshot.receivables;
    if (snapshot.overdueReceivables > 0) collections.overdueAmount = snapshot.overdueReceivables;
    if (snapshot.overdueInvoiceCount > 0) collections.overdueCount = snapshot.overdueInvoiceCount;
    if (snapshot.avgDaysToPay > 0) collections.averageDaysToPay = Math.round(snapshot.avgDaysToPay);
    if (snapshot.collectionRate > 0) {
      collections.collectionEfficiencyPct = Math.round(snapshot.collectionRate * 100);
    }

    gst.outputLiability = snapshot.outputTax;
    gst.inputTaxCredit = snapshot.itcAvailable;
    gst.netGSTPayable = snapshot.gstLiability;

    healthScore.overall = snapshot.healthScore;
    healthScore.tier =
      snapshot.healthScore >= 80 ? 'excellent' :
      snapshot.healthScore >= 65 ? 'healthy' :
      snapshot.healthScore >= 45 ? 'attention' :
      snapshot.healthScore >= 25 ? 'at_risk' : 'critical';

    risks.overallRiskScore = snapshot.riskScore;
    risks.overallRiskLevel =
      snapshot.riskScore >= 60 ? 'critical' :
      snapshot.riskScore >= 40 ? 'high' :
      snapshot.riskScore >= 20 ? 'medium' : 'low';

    executiveSummary.healthScore = snapshot.healthScore;
    executiveSummary.healthTier = healthScore.tier;
    executiveSummary.revenueThisMonth = Math.round(revenue.thisMonth);
    executiveSummary.revenueGrowthPct = revenue.growthPct;
    executiveSummary.netProfit = Math.round(snapshot.profit);
    executiveSummary.netMarginPct = profitability.netMarginPct;
    executiveSummary.cashPosition = Math.round(snapshot.cash);
    executiveSummary.runwayDays = cashFlow.runwayDays;
  }

  return {
    executiveSummary,
    healthScore,
    revenue,
    profitability,
    cashFlow,
    workingCapital,
    expenses,
    collections,
    gst,
    forecast,
    risks,
    recommendations,
    generatedAt: new Date().toISOString(),
    hasLiveData: data.hasLiveData || (snapshot !== null && (snapshot.revenue > 0 || snapshot.cash > 0)),
    dataSources: data.dataSources,
    clientCount: data.clients.length,
    invoiceCount: data.invoices.length,
    tagline: TAGLINE,
  };
}

// ─── Empty bundle (used by both the tenant-gate AND engine-failure fallback) ──

function emptyBundle(): FinancialIntelligenceBundle {
  return {
    executiveSummary: emptyExec(),
    healthScore: emptyHealth(),
    revenue: emptyRevenue(),
    profitability: emptyProfitability(),
    cashFlow: emptyCashFlow(),
    workingCapital: emptyWorkingCapital(),
    expenses: emptyExpenses(),
    collections: emptyCollections(),
    gst: emptyGST(),
    forecast: emptyForecast(),
    risks: emptyRisks(),
    recommendations: { recommendations: [], totalImpactValue: 0, criticalCount: 0, generatedAt: new Date().toISOString() },
    generatedAt: new Date().toISOString(),
    hasLiveData: false,
    dataSources: [],
    clientCount: 0,
    invoiceCount: 0,
    tagline: TAGLINE,
  };
}

// ─── Empty states (for graceful failure) ─────────────────────────────────────

function emptyRevenue(): RevenueAnalytics {
  return {
    today: 0, thisWeek: 0, thisMonth: 0, thisQuarter: 0, thisYear: 0, lastMonth: 0,
    growthPct: 0, qoqGrowthPct: 0, yoyGrowthPct: 0,
    periods: { monthly: [], quarterly: [], yearly: [], ytdRevenue: 0, ytdGrowthPct: 0 },
    byClient: [], byIndustry: [], topClients: [], trend: 'stable',
    forecast: { thirtyDay: 0, ninetyDay: 0, yearEnd: 0 }, sparkline: [],
  };
}

function emptyProfitability(): ProfitabilityAnalytics {
  return {
    revenue: 0, cogs: 0, grossProfit: 0, grossMarginPct: 0, opex: 0,
    operatingMarginPct: 0, ebitda: 0, ebitdaMarginPct: 0, netProfit: 0,
    netMarginPct: 0, expenseRatioPct: 0, monthlyTrends: [], customerProfitability: [],
    vendorCosts: [], trend: 'stable',
  };
}

function emptyCashFlow(): CashFlowAnalytics {
  return {
    currentCash: 0, availableCash: 0, burnRatePerDay: 0, burnRatePerMonth: 0,
    runwayDays: 0, runwayDate: null, inflowThisMonth: 0, outflowThisMonth: 0,
    netThisMonth: 0, projections: [], whyDecreasing: ['No cash flow data available.'], trend: 'stable',
  };
}

function emptyWorkingCapital(): WorkingCapitalAnalytics {
  return {
    currentAssets: 0, currentLiabilities: 0, workingCapital: 0,
    workingCapitalRatio: 0, quickRatio: 0, liquidityRisk: 'low',
    liquidityRiskReason: 'No working capital data available.',
    accountsReceivable: 0, accountsPayable: 0, inventoryValue: 0,
    prepaidExpenses: 0, shortTermDebt: 0, trend: 'stable',
  };
}

function emptyExpenses(): ExpenseAnalytics {
  return {
    totalThisMonth: 0, totalLastMonth: 0, momChangePct: 0, avgMonthly: 0,
    byCategory: [], monthlyTrends: [], topVendors: [],
    recurringExpenses: 0, oneTimeExpenses: 0, trend: 'stable',
  };
}

function emptyCollections(): CollectionAnalytics {
  return {
    totalOutstanding: 0, overdueAmount: 0, overdueCount: 0,
    expectedCollections30d: 0, averageDaysToPay: 30, collectionEfficiencyPct: 100,
    badDebtReserve: 0, latePayments: [], riskyClients: [],
    recoveryStrategy: ['No collection data available.'], trend: 'stable',
  };
}

function emptyForecast(): ForecastAnalytics {
  return {
    rows: [], overallConfidencePct: 0,
    methodology: 'No forecast data available — connect business data to generate forecasts.',
    generatedAt: new Date().toISOString(),
  };
}

function emptyGST(): GSTPositionAnalytics {
  return {
    outputLiability: 0, inputTaxCredit: 0, netGSTPayable: 0, itcUtilizationPct: 0,
    pendingFilings: 0, overdueFilings: 0, upcomingDueDates: [], itcAtRisk: 0,
    itcReversalRisk: 0, filingHistory: [],
  };
}

function emptyRisks(): BusinessRiskEngine {
  return {
    risks: [], overallRiskLevel: 'low' as SeverityLevel, overallRiskScore: 0,
    criticalCount: 0, highCount: 0, generatedAt: new Date().toISOString(),
  };
}

function emptyHealth(): RealFinancialHealthScore {
  return {
    overall: 0, tier: 'attention', factors: [],
    summary: 'No health data available — connect business data to compute health score.',
    topDriver: 'No data', topDrag: 'No data', asOfDate: new Date().toISOString(),
  };
}

function emptyExec(): ExecutiveSummary {
  return {
    headline: 'Connect business data to generate executive summary.',
    healthScore: 0, healthTier: 'unknown', revenueThisMonth: 0, revenueGrowthPct: 0,
    netProfit: 0, netMarginPct: 0, cashPosition: 0, runwayDays: 0, burnRatePerDay: 0,
    topRisk: 'No data', topOpportunity: 'No data', keyMetrics: [],
    generatedAt: new Date().toISOString(),
  };
}
