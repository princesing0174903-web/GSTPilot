// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Infinity™ — Business Snapshot Service (SINGLE SOURCE OF TRUTH)
// ═══════════════════════════════════════════════════════════════════════════════
//
// This is THE one centralized service that computes every business metric.
// Every page — Home Dashboard, Oracle, AI CFO, Run Business, Autonomous — MUST
// read from this service. No page is allowed to calculate Revenue, Cash, Profit,
// Customers, Invoices, Receivables, Payables, GST Liability, ITC, or Health
// Score independently.
//
// PRINCIPLES:
//   1. Read ONLY from Prisma (real DB rows). Never mock, never fabricate.
//   2. If the DB has no data, return ZERO values — never invent numbers.
//   3. Tenant-scoped: every query filters by organizationId (the Firm bridge).
//   4. One calculation engine: the Financial Engine (./financial-engine) derives
//      Forecast, Risk Score, Collection Rate, Working Capital, Runway from the
//      raw snapshot. No duplicate calculations anywhere.
//   5. Oracle reads this snapshot — Oracle NEVER calls external APIs directly.
//
// DATA SOURCES (all Prisma, all real):
//   • Invoice (sales)         → Revenue, Receivables, Output Tax, GST Collected
//   • PurchaseBill (purchases) → Payables, Input Tax (ITC)
//   • Expense (operational)    → Operating Expenses
//   • Payment (settlements)    → Cash Flow, Collection Rate
//   • BankAccount + BankTransaction → Cash Position
//   • Client (customers)       → Customer Count, Health Score
//   • GSTRFiling               → GST Compliance, Filing Status
//   • ZohoCustomer + ZohoInvoice + ZohoBill (synced from Zoho Books) → live ERP
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import {
  computeCollectionRate,
  computeWorkingCapital,
  computeRunway,
  computeForecast,
  computeGstLiability,
  type FinancialEngineResult,
} from './financial-engine';
import { emitTimelineEvent } from '@/lib/timeline/emit';
import { isLocalOrgId } from '@/lib/gstpilot-data/local-workspace';

// ─── Types ────────────────────────────────────────────────────────────────────

// ─── Health Score Engine (CANONICAL) ──────────────────────────────────────────
//
// This is THE single source of truth for the business Health Score + Risk Score.
// Every other module (cfo/engine, oracle/briefing, intelligence/data-cloud,
// ai-provider/scoring, financial-engine/businessSnapshot) MUST delegate to
// getBusinessSnapshot().healthScore / .riskScore — never re-implement.
//
// Replaces the previous 6+ duplicate computeHealthScore/calculateHealthScore
// implementations across the codebase (see AUDIT-DUP-1 in worklog.md).

export type HealthScoreLabel = 'Excellent' | 'Good' | 'Fair' | 'Poor' | 'Critical';

/** A single weighted factor contributing to the composite Health Score. */
export interface HealthScoreFactor {
  key: string;
  label: string;
  weight: number;          // 0-1 (e.g. 0.20 = 20% weight)
  score: number;           // 0-100 (raw sub-score for this factor)
  contribution: number;    // 0-100 (score * weight — actual contribution to composite)
  detail: string;          // human-readable explanation
}

/** A single risk factor (only contributes if triggered). */
export interface RiskScoreFactor {
  key: string;
  label: string;
  impact: number;          // points added to risk score when triggered
  detail: string;
  triggered: boolean;
}

export interface HealthScoreResult {
  score: number;           // 0-100
  label: HealthScoreLabel;
  factors: HealthScoreFactor[];
}

export interface RiskScoreResult {
  score: number;           // 0-100 (higher = riskier)
  factors: RiskScoreFactor[];
}

/**
 * The input contract for the canonical Health Score engine.
 *
 * `getBusinessSnapshot()` gathers every field below from tenant-scoped Prisma
 * queries and passes the assembled object to `computeHealthScore()` and
 * `computeRiskScore()`. Other modules that want to recompute a Health Score
 * without doing a full snapshot fetch should assemble the same shape.
 */
export interface BusinessSnapshotInput {
  revenue: number;             // total invoiced this FY
  expenses: number;            // purchases + operating expenses this FY
  cash: number;                // current cash position
  receivables: number;         // unpaid invoice balances
  payables: number;            // unpaid purchase bill balances
  overdueReceivables: number;  // receivables past due date (₹)
  overdueInvoiceCount: number; // count of overdue invoices
  totalCollected: number;      // payments received from customers
  filedReturns: number;        // GSTRFilings with status='filed'
  pendingReturns: number;      // GSTRFilings with status != 'filed'
  overdueReturns: number;      // GSTRFilings past due date
  revenueThisMonth: number;    // invoiced sales in the current month
  revenueLastMonth: number;    // invoiced sales in the previous month
  topCustomerShare: number;    // 0-1 (top customer's revenue / total revenue)
  avgDaysToPay: number;        // avg days between invoice date and payment date
  runwayMonths: number;        // cash / monthly burn (Infinity if no burn)
}

/** The canonical business snapshot. Every metric the app shows comes from here. */
export interface BusinessSnapshot {
  organizationId: string;
  generatedAt: string;

  // ── Headline financials ──
  revenue: number;          // total invoiced (sales) this financial year
  expenses: number;         // operating expenses + purchases this financial year
  profit: number;           // revenue - expenses
  cash: number;             // current cash position (bank balances or net payment flow)
  profitMargin: number;     // profit / revenue (0-1)

  // ── Customers & invoices ──
  customerCount: number;    // count of Client rows for this org
  vendorCount: number;      // count of distinct PurchaseBill.vendorName
  invoiceCount: number;     // total sales invoices
  billCount: number;        // total purchase bills
  expenseRecordCount: number;

  // ── Receivables & payables ──
  receivables: number;      // sum of Invoice.balanceAmount (unpaid)
  payables: number;         // sum of PurchaseBill.balanceAmount (unpaid)
  overdueReceivables: number;  // receivables past due date
  overduePayables: number;     // payables past due date
  overdueInvoiceCount: number; // count of overdue invoices (NEW)

  // ── GST ──
  outputTax: number;        // GST collected on sales (cgst+sgst+igst+cess on invoices)
  inputTax: number;         // ITC — GST paid on purchases (gstAmount on PurchaseBill)
  itcAvailable: number;     // same as inputTax (input tax credit available)
  gstLiability: number;     // outputTax - inputTax (net GST payable)
  gstCollected: number;     // alias for outputTax

  // ── Payments & cash flow ──
  totalCollected: number;   // sum of customer payments received
  totalPaid: number;        // sum of vendor payments made
  netCashFlow: number;      // totalCollected - totalPaid
  avgDaysToPay: number;     // average days between invoice date and payment date (NEW)

  // ── Compliance ──
  filedReturns: number;     // GSTRFiling count with status='filed'
  pendingReturns: number;   // GSTRFiling count with status != 'filed'
  overdueReturns: number;   // GSTRFiling past due date, not filed

  // ── Revenue trend (NEW) ──
  revenueThisMonth: number;   // invoiced sales in the current month
  revenueLastMonth: number;   // invoiced sales in the previous month
  topCustomerShare: number;   // 0-1 (top customer's revenue / total revenue)

  // ── Derived metrics (from the Health Score Engine) ──
  healthScore: number;                 // 0-100 composite (canonical)
  healthScoreLabel: HealthScoreLabel;  // 'Excellent' | 'Good' | 'Fair' | 'Poor' | 'Critical' (NEW)
  healthScoreFactors: HealthScoreFactor[]; // per-factor breakdown (NEW)
  riskScore: number;                   // 0-100 (higher = riskier) (canonical)
  riskScoreFactors: RiskScoreFactor[]; // per-factor breakdown (NEW)
  collectionRate: number;    // 0-1 (collected / invoiced)
  workingCapital: number;    // receivables - payables
  runwayDays: number;        // cash / monthly burn (Infinity if no burn)
  forecast: {
    nextMonthRevenue: number;
    nextMonthExpenses: number;
    trend: 'up' | 'down' | 'flat';
    confidence: number;     // 0-1
  };

  // ── Per-entity counts (for the live dashboard) ──
  perEntity: {
    zohoCustomers: number;
    zohoVendors: number;
    zohoItems: number;
    zohoInvoices: number;
    zohoBills: number;
    zohoPaymentsReceived: number;
    zohoPaymentsMade: number;
    zohoCreditNotes: number;
    zohoExpenses: number;
    zohoTaxes: number;
    zohoJournals: number;
    zohoBankAccounts: number;
    zohoBankTransactions: number;
  };

  // ── Last sync info ──
  lastSyncAt: string | null;
  lastSyncStatus: 'completed' | 'partial' | 'failed' | 'never';
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns the start of the current Indian financial year (April 1). */
function financialYearStart(now = new Date()): Date {
  const year = now.getFullYear();
  // Indian FY: April 1. If before April, FY started previous year.
  const fyStartYear = now.getMonth() < 3 ? year - 1 : year;
  return new Date(fyStartYear, 3, 1); // Month is 0-indexed: 3 = April
}

/** Sum helper for aggregate queries. */
function sum(rows: Array<{ _sum?: { value?: number | null } | number | null }>): number {
  return rows.reduce((acc, r) => {
    const v = typeof r === 'number' ? r : (r?._sum?.value ?? 0);
    return acc + (typeof v === 'number' ? v : 0);
  }, 0);
}

/**
 * Safely count rows in a Prisma model that MAY not exist in the generated
 * client yet (e.g. ZohoVendor before Phase 5 schema push). Returns 0 if the
 * model accessor is undefined or the query fails — never throws.
 */
async function safeCount(model: any, where: Record<string, unknown>): Promise<number> {
  try {
    if (!model || typeof model.count !== 'function') return 0;
    return await model.count({ where });
  } catch (e) {
    console.warn('[snapshot] safeCount failed:', e instanceof Error ? e.message : e);
    return 0;
  }
}

/** Safely findFirst on a model that may not exist in the generated client. */
async function safeFindFirst(model: any, args: Record<string, unknown>): Promise<any> {
  try {
    if (!model || typeof model.findFirst !== 'function') return null;
    return await model.findFirst(args);
  } catch (e) {
    console.warn('[snapshot] safeFindFirst failed:', e instanceof Error ? e.message : e);
    return null;
  }
}

/**
 * Safely aggregate on a model that may not exist in the generated client.
 * Returns a default empty aggregate result if the model is missing.
 */
async function safeAggregate(model: any, args: Record<string, unknown>): Promise<any> {
  const empty = { _sum: {}, _count: 0 };
  try {
    if (!model || typeof model.aggregate !== 'function') return empty;
    return await model.aggregate(args);
  } catch (e) {
    console.warn('[snapshot] safeAggregate failed:', e instanceof Error ? e.message : e);
    return empty;
  }
}

/** Format an INR amount with thousand separators (no decimals). */
function inr(n: number): string {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Math.round(n));
}

/** Clamp a number to [min, max]. */
function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

// ─── CANONICAL Health Score Engine ────────────────────────────────────────────
//
// Replaces the previous 6+ duplicate computeHealthScore implementations:
//   1. financial-engine/businessSnapshot.ts → calculateHealth (now delegates)
//   2. cfo/engine.ts:378                     → computeHealthScore (now delegates)
//   3. ai-provider/scoring.ts:30             → computeBusinessScoreFromContext (pure
//                                              transformer; orchestrator overrides
//                                              with snapshot-sourced score)
//   4. oracle/briefing.ts:33                 → computeHealthScore(signals) (now
//                                              delegates via assembleBriefing input)
//   5. intelligence/data-cloud.ts:496        → computeHealthScore(input) (now delegates)
//   6. gst-utils.ts:45                       → calculateHealthScore (renamed to
//                                              calculateGSTDataQualityScore —
//                                              DIFFERENT semantics, kept separate)
//
// Factors (weighted, sum to 100%):
//   • Revenue trend           (20%)  current vs previous month
//   • Outstanding percentage  (15%)  receivables / revenue (lower is better)
//   • Cash balance / runway   (15%)  months of cash vs monthly burn
//   • Compliance status       (15%)  GST filings up to date
//   • Overdue invoices        (10%)  count + value past due
//   • Customer concentration  (10%)  top customer's share of revenue
//   • Payment delays          (10%)  avg days to pay vs 45-day target
//   • Collection rate         (5%)   collected / invoiced

export function computeHealthScore(input: BusinessSnapshotInput): HealthScoreResult {
  // Honest empty state — if there is literally no business activity, return 0.
  const hasAnyData =
    input.revenue > 0 ||
    input.cash > 0 ||
    input.receivables > 0 ||
    input.filedReturns > 0 ||
    input.pendingReturns > 0 ||
    input.revenueThisMonth > 0 ||
    input.revenueLastMonth > 0;
  if (!hasAnyData) {
    return { score: 0, label: 'Critical', factors: [] };
  }

  const factors: HealthScoreFactor[] = [];

  // ── 1. Revenue trend (20%) — current month vs previous month ──
  const revTrendPct = input.revenueLastMonth > 0
    ? ((input.revenueThisMonth - input.revenueLastMonth) / input.revenueLastMonth) * 100
    : input.revenueThisMonth > 0 ? 100 : 0;
  let revTrendScore: number;
  if (input.revenueThisMonth === 0 && input.revenueLastMonth === 0) {
    revTrendScore = 50; // neutral — no recent activity
  } else if (revTrendPct > 20) {
    revTrendScore = 100;
  } else if (revTrendPct > 5) {
    revTrendScore = 80;
  } else if (revTrendPct > 0) {
    revTrendScore = 65;
  } else if (revTrendPct > -10) {
    revTrendScore = 40;
  } else if (revTrendPct > -25) {
    revTrendScore = 25;
  } else {
    revTrendScore = 10;
  }
  factors.push({
    key: 'revenue_trend',
    label: 'Revenue Trend',
    weight: 0.20,
    score: revTrendScore,
    contribution: revTrendScore * 0.20,
    detail: `${revTrendPct >= 0 ? '+' : ''}${revTrendPct.toFixed(1)}% MoM (₹${inr(input.revenueThisMonth)} vs ₹${inr(input.revenueLastMonth)})`,
  });

  // ── 2. Outstanding percentage (15%) — receivables / revenue ──
  const outstandingPct = input.revenue > 0
    ? input.receivables / input.revenue
    : input.receivables > 0 ? 1 : 0;
  let outstandingScore: number;
  if (outstandingPct > 0.75) outstandingScore = 15;
  else if (outstandingPct > 0.50) outstandingScore = 30;
  else if (outstandingPct > 0.30) outstandingScore = 55;
  else if (outstandingPct > 0.15) outstandingScore = 75;
  else if (outstandingPct > 0) outstandingScore = 90;
  else outstandingScore = 100;
  factors.push({
    key: 'outstanding_percentage',
    label: 'Outstanding Percentage',
    weight: 0.15,
    score: outstandingScore,
    contribution: outstandingScore * 0.15,
    detail: `${(outstandingPct * 100).toFixed(1)}% of revenue outstanding (₹${inr(input.receivables)})`,
  });

  // ── 3. Cash balance / runway (15%) ──
  // >3 months runway = healthy, <1 month = critical.
  const runwayMonths = Number.isFinite(input.runwayMonths) ? input.runwayMonths : 999;
  let cashScore: number;
  if (input.cash > 0 && input.expenses === 0) {
    cashScore = 90; // has cash, no burn — healthy but unknown horizon
  } else if (runwayMonths >= 6) {
    cashScore = 100;
  } else if (runwayMonths >= 3) {
    cashScore = 85;
  } else if (runwayMonths >= 2) {
    cashScore = 70;
  } else if (runwayMonths >= 1) {
    cashScore = 50;
  } else if (input.cash > 0) {
    cashScore = 30;
  } else {
    cashScore = 10;
  }
  factors.push({
    key: 'cash_balance',
    label: 'Cash Balance & Runway',
    weight: 0.15,
    score: cashScore,
    contribution: cashScore * 0.15,
    detail: Number.isFinite(input.runwayMonths)
      ? `${input.runwayMonths.toFixed(1)} months runway (₹${inr(input.cash)} cash)`
      : `unbounded runway (₹${inr(input.cash)} cash, no burn)`,
  });

  // ── 4. Compliance status (15%) — GST filings ──
  const totalReturns = input.filedReturns + input.pendingReturns;
  let complianceScore: number;
  if (totalReturns > 0) {
    const filedRate = input.filedReturns / totalReturns;
    complianceScore = filedRate * 100;
    if (input.overdueReturns > 0) {
      complianceScore -= (input.overdueReturns / totalReturns) * 50;
    }
    complianceScore = clamp(complianceScore, 0, 100);
  } else if (input.revenue > 0) {
    complianceScore = 30; // has revenue but no filings — compliance risk
  } else {
    complianceScore = 100; // no filings AND no revenue — neutral
  }
  factors.push({
    key: 'compliance_status',
    label: 'Compliance Status',
    weight: 0.15,
    score: complianceScore,
    contribution: complianceScore * 0.15,
    detail: `${input.filedReturns} filed, ${input.pendingReturns} pending, ${input.overdueReturns} overdue`,
  });

  // ── 5. Overdue invoices (10%) — count and value ──
  let overdueScore: number;
  if (input.receivables > 0 && input.overdueReceivables > 0) {
    const overdueRatio = input.overdueReceivables / input.receivables;
    if (overdueRatio > 0.5) overdueScore = 15;
    else if (overdueRatio > 0.25) overdueScore = 35;
    else if (overdueRatio > 0.10) overdueScore = 60;
    else if (overdueRatio > 0.05) overdueScore = 80;
    else overdueScore = 90;
  } else if (input.overdueInvoiceCount > 0) {
    overdueScore = 70;
  } else {
    overdueScore = 100;
  }
  factors.push({
    key: 'overdue_invoices',
    label: 'Overdue Invoices',
    weight: 0.10,
    score: overdueScore,
    contribution: overdueScore * 0.10,
    detail: `${input.overdueInvoiceCount} overdue invoice(s), ₹${inr(input.overdueReceivables)} exposure`,
  });

  // ── 6. Customer concentration (10%) — top customer's share of revenue ──
  const topShare = clamp(input.topCustomerShare, 0, 1);
  let concentrationScore: number;
  if (topShare > 0.70) concentrationScore = 15;
  else if (topShare > 0.50) concentrationScore = 35;
  else if (topShare > 0.40) concentrationScore = 55;
  else if (topShare > 0.25) concentrationScore = 75;
  else if (topShare > 0) concentrationScore = 90;
  else concentrationScore = 100;
  factors.push({
    key: 'customer_concentration',
    label: 'Customer Concentration',
    weight: 0.10,
    score: concentrationScore,
    contribution: concentrationScore * 0.10,
    detail: `Top customer = ${(topShare * 100).toFixed(1)}% of revenue`,
  });

  // ── 7. Payment delays (10%) — avg days to pay vs 45-day target ──
  const adp = input.avgDaysToPay;
  let paymentDelayScore: number;
  if (adp <= 0) {
    // No payment history — neutral, not punitive.
    paymentDelayScore = 70;
  } else if (adp > 90) {
    paymentDelayScore = 10;
  } else if (adp > 60) {
    paymentDelayScore = 35;
  } else if (adp > 45) {
    paymentDelayScore = 55;
  } else if (adp > 30) {
    paymentDelayScore = 75;
  } else {
    paymentDelayScore = 90;
  }
  factors.push({
    key: 'payment_delays',
    label: 'Payment Delays',
    weight: 0.10,
    score: paymentDelayScore,
    contribution: paymentDelayScore * 0.10,
    detail: adp > 0 ? `Avg ${adp.toFixed(0)} days to pay (target ≤ 45)` : 'No payment history yet',
  });

  // ── 8. Collection rate (5%) — collected / invoiced ──
  const collectionRate = input.revenue > 0
    ? clamp(input.totalCollected / input.revenue, 0, 1)
    : 0;
  const collectionScore = collectionRate * 100;
  factors.push({
    key: 'collection_rate',
    label: 'Collection Rate',
    weight: 0.05,
    score: collectionScore,
    contribution: collectionScore * 0.05,
    detail: `${(collectionRate * 100).toFixed(1)}% of invoiced revenue collected`,
  });

  const composite = factors.reduce((s, f) => s + f.contribution, 0);
  const score = Math.round(clamp(composite, 0, 100));

  const label: HealthScoreLabel =
    score >= 80 ? 'Excellent' :
    score >= 65 ? 'Good' :
    score >= 45 ? 'Fair' :
    score >= 25 ? 'Poor' :
    'Critical';

  return { score, label, factors };
}

// ─── CANONICAL Risk Score Engine (0-100, higher = riskier) ───────────────────
//
// Additive model — each triggered factor contributes its impact to the total,
// capped at 100. This is intentionally additive (not weighted-average) so the
// "why" of every point is auditable: each risk point traces to a specific
// triggered condition.

export function computeRiskScore(input: BusinessSnapshotInput): RiskScoreResult {
  const runwayMonths = Number.isFinite(input.runwayMonths) ? input.runwayMonths : 999;
  const outstandingPct = input.revenue > 0 ? input.receivables / input.revenue : 0;
  const overdueRatio = input.receivables > 0 ? input.overdueReceivables / input.receivables : 0;

  const factors: RiskScoreFactor[] = [
    {
      key: 'cash_runway',
      label: 'Cash runway < 2 months',
      impact: 30,
      detail: `Runway = ${Number.isFinite(input.runwayMonths) ? input.runwayMonths.toFixed(1) + ' months' : 'unbounded'}, cash = ₹${inr(input.cash)}`,
      triggered: input.cash < 0 || (runwayMonths < 2 && input.expenses > 0),
    },
    {
      key: 'high_outstanding',
      label: 'Outstanding > 60% of revenue',
      impact: 25,
      detail: `${(outstandingPct * 100).toFixed(1)}% of revenue is outstanding (₹${inr(input.receivables)})`,
      triggered: outstandingPct > 0.60,
    },
    {
      key: 'high_overdue',
      label: 'Overdue invoices > 20% of total receivables',
      impact: 20,
      detail: `${input.overdueInvoiceCount} overdue invoice(s), ₹${inr(input.overdueReceivables)} (${(overdueRatio * 100).toFixed(1)}% of receivables)`,
      triggered: overdueRatio > 0.20,
    },
    {
      key: 'overdue_filings',
      label: 'Overdue GST filings',
      impact: 15,
      detail: `${input.overdueReturns} overdue return(s)`,
      triggered: input.overdueReturns > 0,
    },
    {
      key: 'high_concentration',
      label: 'Customer concentration > 50%',
      impact: 10,
      detail: `Top customer = ${(input.topCustomerShare * 100).toFixed(1)}% of revenue`,
      triggered: input.topCustomerShare > 0.50,
    },
  ];

  const raw = factors.filter((f) => f.triggered).reduce((s, f) => s + f.impact, 0);
  const score = Math.round(clamp(raw, 0, 100));

  return { score, factors };
}

// ─── In-memory cache (30s TTL — prevents redundant Prisma queries within a request burst) ──

interface CacheEntry {
  snapshot: BusinessSnapshot;
  expiresAt: number;
}
const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 30 * 1000;

// ─── The canonical function ──────────────────────────────────────────────────

/**
 * Compute the complete business snapshot for a given organization.
 *
 * This is the SINGLE source of truth. Every page and every API must call this
 * function (or the /api/business-snapshot endpoint) to get business metrics.
 * No page is allowed to compute Revenue, Cash, Profit, etc. independently.
 *
 * @param organizationId The org/firm id (e.g. "preview-org" or a real Firestore org id)
 * @param opts.forceRefresh Bypass the 30s cache (use after a sync completes)
 */
export async function getBusinessSnapshot(
  organizationId: string,
  opts: { forceRefresh?: boolean } = {},
): Promise<BusinessSnapshot> {
  // Cache check
  if (!opts.forceRefresh) {
    const cached = cache.get(organizationId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.snapshot;
    }
  }

  const fyStart = financialYearStart();
  const fyStartStr = fyStart.toISOString();

  // Month boundaries for the revenue trend (current month vs previous month).
  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
  const nowIso = now.toISOString();

  // ── Run all independent Prisma queries in parallel ──
  // Every query is tenant-scoped by firmId = organizationId.
  // If the org has no data, Prisma returns 0 / [] — we never fabricate.

  const [
    invoiceAgg,
    purchaseAgg,
    expenseAgg,
    paymentReceivedAgg,
    paymentMadeAgg,
    clientCount,
    vendorCount,
    invoiceCount,
    billCount,
    expenseCount,
    filedReturnsCount,
    pendingReturnsCount,
    overdueReturnsCount,
    bankBalanceAgg,
    // Zoho synced entity counts
    zohoCustomersCount,
    zohoVendorsCount,
    zohoItemsCount,
    zohoInvoicesCount,
    zohoBillsCount,
    zohoPaymentsReceivedCount,
    zohoPaymentsMadeCount,
    zohoCreditNotesCount,
    zohoExpensesCount,
    zohoTaxesCount,
    zohoJournalsCount,
    zohoBankAccountsCount,
    zohoBankTransactionsCount,
    lastSyncLog,
    // Zoho synced financial aggregates
    zohoInvoiceAgg,
    zohoBillAgg,
    zohoPaymentReceivedAgg,
    zohoPaymentMadeAgg,
    zohoExpenseAgg,
    zohoBankAccountAgg,
    // ── Health Score Engine inputs (NEW) ──
    revenueThisMonthAgg,        // totalAmount where createdAt ∈ [thisMonthStart, now]
    revenueLastMonthAgg,        // totalAmount where createdAt ∈ [lastMonthStart, lastMonthEnd]
    topCustomerGroup,           // groupBy buyerName with sum(totalAmount), take top 1
    overdueInvoiceStats,        // count + sum(balanceAmount) where dueDate < now AND status != 'paid'
    paidPaymentsForAdp,         // recent customer payments with invoiceId, paymentDate (for avgDaysToPay)
  ] = await Promise.all([
    // Invoices (sales) — this FY
    // Excludes 'cancelled' invoices (voided → never revenue). 'draft' is
    // intentionally kept because the legacy POST defaults new invoices to
    // 'draft' and many flows don't transition to 'sent' until marked paid;
    // excluding drafts would zero-out revenue for orgs that haven't issued
    // formal "sent" transitions. See Phase 3 canonical-map audit.
    db.invoice.aggregate({
      where: { client: { firmId: organizationId }, createdAt: { gte: fyStart }, status: { not: 'cancelled' } },
      _sum: { totalAmount: true, balanceAmount: true, cgst: true, sgst: true, igst: true, cess: true, paidAmount: true },
      _count: true,
    }),
    // Purchase bills — this FY
    db.purchaseBill.aggregate({
      where: { client: { firmId: organizationId }, createdAt: { gte: fyStart } },
      _sum: { totalAmount: true, balanceAmount: true, gstAmount: true, paidAmount: true },
      _count: true,
    }),
    // Expenses — this FY
    db.expense.aggregate({
      where: { client: { firmId: organizationId }, createdAt: { gte: fyStart } },
      _sum: { amount: true, gst: true },
      _count: true,
    }),
    // Payments received (from customers)
    db.payment.aggregate({
      where: { client: { firmId: organizationId }, partyType: 'customer', status: 'completed' },
      _sum: { amount: true },
    }),
    // Payments made (to vendors)
    db.payment.aggregate({
      where: { client: { firmId: organizationId }, partyType: 'vendor', status: 'completed' },
      _sum: { amount: true },
    }),
    // Client (customer) count
    db.client.count({ where: { firmId: organizationId } }),
    // Vendor count (distinct vendorName on PurchaseBill)
    db.purchaseBill.groupBy({
      by: ['vendorName'],
      where: { client: { firmId: organizationId } },
    }).then((r) => r.length),
    // Invoice count (all-time, native only — Zoho count is added below to avoid double-counting mirror rows)
    db.invoice.count({ where: { client: { firmId: organizationId } } }),
    // Bill count (all-time, native only — Zoho count is added below)
    db.purchaseBill.count({ where: { client: { firmId: organizationId } } }),
    // Expense count (all-time)
    db.expense.count({ where: { client: { firmId: organizationId } } }),
    // GST returns filed
    db.gSTRFiling.count({ where: { client: { firmId: organizationId }, status: 'filed' } }),
    // GST returns pending
    db.gSTRFiling.count({
      where: { client: { firmId: organizationId }, status: { not: 'filed' } },
    }),
    // GST returns overdue (pending returns older than 20 days — GSTRFiling has no dueDate field)
    db.gSTRFiling.count({
      where: {
        client: { firmId: organizationId },
        status: { not: 'filed' },
        createdAt: { lt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000) },
      },
    }).catch((e: unknown) => { console.warn("[snapshot] Prisma query failed, returning 0:", e instanceof Error ? e.message : e); return 0; }),
    // BankAccount native balances — org-scoped. BankAccount has an
    // organizationId column (schema.prisma:2987), so this is safe.
    // Phase 2 fix: previously returned null due to a stale comment claiming
    // BankAccount had no organizationId column. Real imported bank balances
    // are now reflected in the dashboard "Cash Position" + Oracle cash flow.
    safeAggregate(db.bankAccount, {
      where: { organizationId },
      _sum: { balance: true, availableBalance: true },
    }),
    // ── Zoho synced entity counts (Phase 5) ──
    // safeCount handles models that don't exist in the generated client yet
    safeCount(db.zohoCustomer, { organizationId }),
    safeCount(db.zohoVendor, { organizationId }),
    safeCount(db.zohoItem, { organizationId }),
    safeCount(db.zohoInvoice, { organizationId }),
    safeCount(db.zohoBill, { organizationId }),
    safeCount(db.zohoPaymentReceived, { organizationId }),
    safeCount(db.zohoPaymentMade, { organizationId }),
    safeCount(db.zohoCreditNote, { organizationId }),
    safeCount(db.zohoExpense, { organizationId }),
    safeCount(db.zohoTax, { organizationId }),
    safeCount(db.zohoJournalEntry, { organizationId }),
    safeCount(db.zohoBankAccount, { organizationId }),
    safeCount(db.zohoBankTransaction, { organizationId }),
    // Last sync log
    safeFindFirst(db.zohoSyncLog, {
      where: { organizationId },
      orderBy: { startedAt: 'desc' },
      select: { startedAt: true, status: true },
    }),
    // These ensure Revenue/Receivables/GST reflect real Zoho Books data even
    // when the native Invoice/PurchaseBill tables are empty.
    safeAggregate(db.zohoInvoice, {
      where: { organizationId },
      _sum: { total: true, balance: true, cgst: true, sgst: true, igst: true, cess: true, totalTax: true, paidAmount: true },
    }),
    safeAggregate(db.zohoBill, {
      where: { organizationId },
      _sum: { total: true, balance: true, totalTax: true, paidAmount: true },
    }),
    safeAggregate(db.zohoPaymentReceived, {
      where: { organizationId },
      _sum: { amount: true },
    }),
    safeAggregate(db.zohoPaymentMade, {
      where: { organizationId },
      _sum: { amount: true },
    }),
    safeAggregate(db.zohoExpense, {
      where: { organizationId },
      _sum: { amount: true },
    }),
    safeAggregate(db.zohoBankAccount, {
      where: { organizationId },
      _sum: { balance: true, availableBalance: true },
    }),
    // ── NEW: Revenue trend (current month) ──
    db.invoice.aggregate({
      where: {
        client: { firmId: organizationId },
        createdAt: { gte: thisMonthStart, lte: now },
      },
      _sum: { totalAmount: true },
    }).catch((e: unknown) => { console.warn("[snapshot] Prisma aggregation failed, returning empty:", e instanceof Error ? e.message : e); return { _sum: { totalAmount: 0 } }; }),
    // ── NEW: Revenue trend (previous month) ──
    db.invoice.aggregate({
      where: {
        client: { firmId: organizationId },
        createdAt: { gte: lastMonthStart, lte: lastMonthEnd },
      },
      _sum: { totalAmount: true },
    }).catch((e: unknown) => { console.warn("[snapshot] Prisma aggregation failed, returning empty:", e instanceof Error ? e.message : e); return { _sum: { totalAmount: 0 } }; }),
    // ── NEW: Top customer concentration (groupBy buyerName, top 1 by revenue) ──
    db.invoice.groupBy({
      by: ['buyerName'],
      where: {
        client: { firmId: organizationId },
        createdAt: { gte: fyStart },
        buyerName: { not: null },
      },
      _sum: { totalAmount: true },
      orderBy: { _sum: { totalAmount: 'desc' } },
      take: 1,
    }).catch((e: unknown) => { console.warn("[snapshot] Prisma groupBy failed, returning empty:", e instanceof Error ? e.message : e); return [] as Array<{ buyerName: string | null; _sum: { totalAmount: number | null } }>; }),
    // ── NEW: Overdue invoice stats (count + sum of balanceAmount past due) ──
    // Synchronous so the Health Score has accurate overdue data without waiting
    // for the background `detectAndEmitOverdueInvoices` task.
    db.invoice.aggregate({
      where: {
        client: { firmId: organizationId },
        dueDate: { not: null, lt: nowIso },
        status: { not: 'paid' },
        paymentStatus: { not: 'paid' },
      },
      _sum: { balanceAmount: true, totalAmount: true },
      _count: true,
    }).catch((e: unknown) => { console.warn("[snapshot] Prisma bank aggregation failed, returning empty:", e instanceof Error ? e.message : e); return { _sum: { balanceAmount: 0, totalAmount: 0 }, _count: 0 }; }),
    // ── NEW: Recent paid customer payments (for avgDaysToPay) ──
    // We fetch the last 200 completed customer payments that are linked to an
    // invoice. Their linked invoice dates are fetched in a follow-up query
    // (Payment has no relation to Invoice — see prisma/schema.prisma).
    db.payment.findMany({
      where: {
        client: { firmId: organizationId },
        partyType: 'customer',
        status: 'completed',
        invoiceId: { not: null },
      },
      select: { invoiceId: true, paymentDate: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    }).catch((e: unknown) => { console.warn("[snapshot] Prisma payments query failed, returning empty:", e instanceof Error ? e.message : e); return [] as Array<{ invoiceId: string | null; paymentDate: string }>; }),
  ]);

  // ── Extract values (all default to 0 if null — honest empty state) ──
  // Native GSTPilot data
  const nativeRevenue = invoiceAgg._sum.totalAmount ?? 0;
  const nativeOutputTax =
    (invoiceAgg._sum.cgst ?? 0) +
    (invoiceAgg._sum.sgst ?? 0) +
    (invoiceAgg._sum.igst ?? 0) +
    (invoiceAgg._sum.cess ?? 0);
  const nativeReceivables = invoiceAgg._sum.balanceAmount ?? 0;
  const nativeCollected = invoiceAgg._sum.paidAmount ?? 0;

  const nativePurchases = purchaseAgg._sum.totalAmount ?? 0;
  const nativeInputTax = purchaseAgg._sum.gstAmount ?? 0;
  const nativePayables = purchaseAgg._sum.balanceAmount ?? 0;

  const nativeOperatingExpenses = expenseAgg._sum.amount ?? 0;
  const expenseGst = expenseAgg._sum.gst ?? 0;

  // ── Merge native + Zoho entity counts ──
  // The native `invoiceCount`/`billCount`/`clientCount`/`vendorCount` above only
  // count native Prisma tables. The Zoho sync mirrors customers into the Client
  // table (so clientCount already reflects Zoho customers), but it does NOT
  // mirror invoices/bills into native Invoice/PurchaseBill tables. So we must
  // ADD the ZohoInvoice / ZohoBill counts here to get the true total count
  // displayed on the dashboard.
  const mergedInvoiceCount = (invoiceCount ?? 0) + ((zohoInvoicesCount ?? 0) as number);
  const mergedBillCount = (billCount ?? 0) + ((zohoBillsCount ?? 0) as number);
  // Customer count: native Client rows already include the Zoho mirror rows
  // (sync-engine.ts upserts a Client for every ZohoCustomer). To avoid
  // double-counting, we take the MAX of (native client count, zoho customer
  // count) — this is correct because every Zoho customer has exactly one
  // mirrored Client row with the same organizationId.
  const mergedCustomerCount = Math.max((clientCount ?? 0) as number, ((zohoCustomersCount ?? 0) as number));
  // Vendor count: same logic — ZohoVendor is NOT mirrored to a native table, so
  // we ADD them.
  const mergedVendorCount = (vendorCount ?? 0) + ((zohoVendorsCount ?? 0) as number);
  // Expense record count: native + Zoho
  const mergedExpenseRecordCount = (expenseCount ?? 0) + ((zohoExpensesCount ?? 0) as number);

  // Zoho-synced data (real Zoho Books records — merged so the snapshot reflects
  // the connected ERP even when native tables are empty)
  const zohoRevenue = (zohoInvoiceAgg?._sum?.total ?? 0) as number;
  // Use totalTax (denormalized) to avoid double-counting with cgst+sgst+igst+cess
  const zohoOutputTax = ((zohoInvoiceAgg?._sum?.totalTax ?? 0) as number);
  const zohoReceivables = (zohoInvoiceAgg?._sum?.balance ?? 0) as number;
  const zohoCollected = (zohoInvoiceAgg?._sum?.paidAmount ?? 0) as number;

  const zohoPurchases = (zohoBillAgg?._sum?.total ?? 0) as number;
  const zohoInputTax = ((zohoBillAgg?._sum?.totalTax ?? 0) as number);
  const zohoPayables = (zohoBillAgg?._sum?.balance ?? 0) as number;

  const zohoExpenses = (zohoExpenseAgg?._sum?.amount ?? 0) as number;

  // Merge: native + Zoho (so both worlds contribute to the single source of truth)
  const revenue = nativeRevenue + zohoRevenue;
  const outputTax = nativeOutputTax + zohoOutputTax;
  const receivables = nativeReceivables + zohoReceivables;
  const totalCollected = nativeCollected + zohoCollected;

  const purchases = nativePurchases + zohoPurchases;
  const inputTax = nativeInputTax + zohoInputTax;
  const payables = nativePayables + zohoPayables;

  const operatingExpenses = nativeOperatingExpenses + zohoExpenses;

  const totalCollectedPayments = (paymentReceivedAgg._sum.amount ?? 0) + ((zohoPaymentReceivedAgg?._sum?.amount ?? 0) as number);
  const totalPaidPayments = (paymentMadeAgg._sum.amount ?? 0) + ((zohoPaymentMadeAgg?._sum?.amount ?? 0) as number);

  const expenses = purchases + operatingExpenses;
  const profit = revenue - expenses;
  const profitMargin = revenue > 0 ? profit / revenue : 0;

  // Cash: prefer bank balances (native + Zoho); fall back to net payment flow
  const nativeBankBalance = bankBalanceAgg._sum?.balance ?? null;
  const zohoBankBalance = (zohoBankAccountAgg?._sum?.balance ?? 0) as number;
  const bankBalance = nativeBankBalance !== null ? nativeBankBalance + zohoBankBalance : zohoBankBalance;
  const cash =
    bankBalance > 0
      ? bankBalance
      : totalCollectedPayments - totalPaidPayments;

  // GST liability: output tax - input tax (net payable to government)
  const gstLiability = computeGstLiability(outputTax, inputTax + expenseGst);
  const netCashFlow = totalCollectedPayments - totalPaidPayments;

  // ── Health Score Engine inputs (NEW) ──
  const revenueThisMonth = (revenueThisMonthAgg?._sum?.totalAmount ?? 0) as number;
  const revenueLastMonth = (revenueLastMonthAgg?._sum?.totalAmount ?? 0) as number;

  // Top customer's share of total revenue (0-1). Defensive: topCustomerGroup
  // is an array of 0 or 1 row from the groupBy query.
  const topCustomerRevenue =
    topCustomerGroup && topCustomerGroup.length > 0
      ? (topCustomerGroup[0]._sum?.totalAmount ?? 0)
      : 0;
  const topCustomerShare = revenue > 0 ? clamp(topCustomerRevenue / revenue, 0, 1) : 0;

  // Overdue invoice stats — populated synchronously so the Health Score engine
  // has accurate data on the first call (background detectAndEmitOverdueInvoices
  // still runs for timeline event emission, but the snapshot values come from
  // this aggregate).
  const overdueReceivables =
    overdueInvoiceStats && overdueInvoiceStats._sum
      ? (overdueInvoiceStats._sum.balanceAmount ?? 0) > 0
        ? (overdueInvoiceStats._sum.balanceAmount as number)
        : (overdueInvoiceStats._sum.totalAmount ?? 0) as number
      : 0;
  const overdueInvoiceCount = overdueInvoiceStats?._count ?? 0;

  // Average days to pay — computed from the linked Payment rows + Invoice
  // invoiceDate lookup. We need to fetch the linked invoice dates in a follow-up
  // query because Payment has no Prisma relation to Invoice.
  const invoiceIdsForAdp = paidPaymentsForAdp
    .map((p) => p.invoiceId)
    .filter((id): id is string => typeof id === 'string' && id.length > 0);
  const distinctInvoiceIds = [...new Set(invoiceIdsForAdp)];

  let avgDaysToPay = 0;
  if (distinctInvoiceIds.length > 0) {
    try {
      const linkedInvoices = await db.invoice.findMany({
        where: { id: { in: distinctInvoiceIds } },
        select: { id: true, invoiceDate: true },
      });
      const invoiceDateById = new Map<string, string>();
      for (const inv of linkedInvoices) {
        if (inv.invoiceDate) invoiceDateById.set(inv.id, inv.invoiceDate);
      }
      const dayDiffs: number[] = [];
      for (const p of paidPaymentsForAdp) {
        if (!p.invoiceId || !p.paymentDate) continue;
        const invDateStr = invoiceDateById.get(p.invoiceId);
        if (!invDateStr) continue;
        const invDate = new Date(invDateStr);
        const payDate = new Date(p.paymentDate);
        if (Number.isNaN(invDate.getTime()) || Number.isNaN(payDate.getTime())) continue;
        const diff = Math.max(0, (payDate.getTime() - invDate.getTime()) / (1000 * 60 * 60 * 24));
        dayDiffs.push(diff);
      }
      if (dayDiffs.length > 0) {
        avgDaysToPay = dayDiffs.reduce((a, b) => a + b, 0) / dayDiffs.length;
      }
    } catch {
      avgDaysToPay = 0;
    }
  }

  // Runway (in months) — used by both the Health Score and Risk Score engines.
  // Infinity if there's no burn (operatingExpenses === 0).
  const runwayMonths =
    operatingExpenses > 0 ? cash / (operatingExpenses / 12) : (cash > 0 ? Infinity : 0);

  // ── CANONICAL Health Score + Risk Score (NEW) ──
  const healthScoreInput: BusinessSnapshotInput = {
    revenue,
    expenses,
    cash,
    receivables,
    payables,
    overdueReceivables,
    overdueInvoiceCount,
    totalCollected,
    filedReturns: filedReturnsCount,
    pendingReturns: pendingReturnsCount,
    overdueReturns: overdueReturnsCount,
    revenueThisMonth,
    revenueLastMonth,
    topCustomerShare,
    avgDaysToPay,
    runwayMonths,
  };

  const healthScoreResult = computeHealthScore(healthScoreInput);
  const riskScoreResult = computeRiskScore(healthScoreInput);

  const collectionRate = computeCollectionRate(revenue, totalCollected);
  const workingCapital = computeWorkingCapital(receivables, payables);
  const runwayDays = computeRunway(cash, operatingExpenses);
  const forecast = computeForecast(revenue, expenses);

  const snapshot: BusinessSnapshot = {
    organizationId,
    generatedAt: new Date().toISOString(),

    revenue,
    expenses,
    profit,
    cash,
    profitMargin,

    customerCount: mergedCustomerCount,
    vendorCount: mergedVendorCount,
    invoiceCount: mergedInvoiceCount,
    billCount: mergedBillCount,
    expenseRecordCount: mergedExpenseRecordCount,

    receivables,
    payables,
    overdueReceivables,
    overduePayables: 0,
    overdueInvoiceCount,

    outputTax,
    inputTax,
    itcAvailable: inputTax,
    gstLiability,
    gstCollected: outputTax,

    totalCollected: totalCollectedPayments,
    totalPaid: totalPaidPayments,
    netCashFlow,
    avgDaysToPay,

    filedReturns: filedReturnsCount,
    pendingReturns: pendingReturnsCount,
    overdueReturns: overdueReturnsCount,

    revenueThisMonth,
    revenueLastMonth,
    topCustomerShare,

    healthScore: healthScoreResult.score,
    healthScoreLabel: healthScoreResult.label,
    healthScoreFactors: healthScoreResult.factors,
    riskScore: riskScoreResult.score,
    riskScoreFactors: riskScoreResult.factors,
    collectionRate,
    workingCapital,
    runwayDays,
    forecast,

    perEntity: {
      zohoCustomers: zohoCustomersCount,
      zohoVendors: zohoVendorsCount,
      zohoItems: zohoItemsCount,
      zohoInvoices: zohoInvoicesCount,
      zohoBills: zohoBillsCount,
      zohoPaymentsReceived: zohoPaymentsReceivedCount,
      zohoPaymentsMade: zohoPaymentsMadeCount,
      zohoCreditNotes: zohoCreditNotesCount,
      zohoExpenses: zohoExpensesCount,
      zohoTaxes: zohoTaxesCount,
      zohoJournals: zohoJournalsCount,
      zohoBankAccounts: zohoBankAccountsCount,
      zohoBankTransactions: zohoBankTransactionsCount,
    },

    lastSyncAt: lastSyncLog?.startedAt?.toISOString() ?? null,
    lastSyncStatus: (lastSyncLog?.status as BusinessSnapshot['lastSyncStatus']) ?? 'never',
  };

  // ── Overdue invoice detection (auto-emit invoice.overdue events) ──
  // Query invoices for this org where dueDate < now AND status != 'paid'.
  // For each overdue invoice, emit a timeline event — deduplicated by
  // invoiceId (skip if an invoice.overdue event was already emitted for the
  // same invoice within the last 24h). This makes overdue invoices appear on
  // the Business Timeline automatically, without the user having to navigate
  // to the Receivables page.
  //
  // Fire-and-forget: this is best-effort observability — never breaks the
  // snapshot. Local- (guest/demo) org IDs are skipped because they have no
  // Prisma backing. The whole block runs in the background; the snapshot
  // is returned immediately without waiting for the emits to complete.
  const snapshotRef = snapshot;
  void detectAndEmitOverdueInvoices(organizationId, snapshotRef).catch(() => {
    /* swallow — see emitTimelineEvent's own try/catch for the warning log */
  });

  // Cache and return
  cache.set(organizationId, {
    snapshot: snapshotRef,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
  return snapshotRef;
}

/**
 * Invalidate the cached Business Snapshot for one org (or every org when
 * `organizationId` is omitted). Safe to call from any server-side mutation
 * route (invoices POST / mark-paid / DELETE, clients POST / PATCH, payments,
 * expenses, bank imports, GST reconciliation runs, Zoho sync, etc.) so the
 * NEXT read reflects the new state without waiting the full 30s TTL.
 *
 * The client-side `invalidateBusinessSnapshot()` event bus already triggers
 * a re-fetch with `?forceRefresh=true` — but if the server cache is stale the
 * re-fetch still returns old numbers. This function clears the server cache
 * so `forceRefresh=true` actually returns fresh data.
 *
 * Usage (server-side, inside any mutation route):
 *   import { invalidateBusinessSnapshotCache } from '@/lib/business/snapshot';
 *   invalidateBusinessSnapshotCache(organizationId);
 */
export function invalidateBusinessSnapshotCache(organizationId?: string): void {
  if (organizationId) {
    cache.delete(organizationId);
  } else {
    cache.clear();
  }
}

/**
 * Background helper that finds overdue invoices for an org and emits
 * `invoice.overdue` timeline events for each (deduplicated by invoiceId
 * within the last 24h). Also fills in `snapshot.overdueReceivables`.
 *
 * This is called fire-and-forget from `getBusinessSnapshot` — it never throws
 * to the caller. The snapshot is returned immediately; this work runs in the
 * background so the dashboard's snapshot polling stays fast.
 */
async function detectAndEmitOverdueInvoices(
  organizationId: string,
  snapshot: BusinessSnapshot,
): Promise<void> {
  // Skip local- org IDs — they have no Prisma backing.
  if (isLocalOrgId(organizationId)) return;

  // Type for a single overdue invoice row (selected fields only).
  type OverdueInvoiceRow = {
    id: string;
    invoiceNumber: string;
    buyerName: string | null;
    totalAmount: number;
    balanceAmount: number;
    dueDate: string | null;
    clientId: string;
  };

  let overdueInvoices: OverdueInvoiceRow[] = [];
  try {
    const nowIso = new Date().toISOString();

    // Find overdue invoices: dueDate is a non-null ISO string earlier than
    // now, and the invoice is not fully paid (status != 'paid' AND
    // paymentStatus != 'paid'). Tenant-scoped via client.firmId.
    overdueInvoices = await db.invoice.findMany({
      where: {
        client: { firmId: organizationId },
        dueDate: { not: null, lt: nowIso },
        status: { not: 'paid' },
        paymentStatus: { not: 'paid' },
      },
      select: {
        id: true,
        invoiceNumber: true,
        buyerName: true,
        totalAmount: true,
        balanceAmount: true,
        dueDate: true,
        clientId: true,
      },
      take: 100, // cap per snapshot run to bound the work
    });
  } catch (err) {
    // Defensive — never break the snapshot. The query failure should be silent.
    console.warn(
      '[snapshot] detectAndEmitOverdueInvoices: invoice query failed (org=%s):',
      organizationId,
      err instanceof Error ? err.message : err,
    );
    return;
  }

  if (overdueInvoices.length === 0) return;

  // Fill in the overdueReceivables field on the snapshot (in-place) so the
  // dashboard shows the real overdue exposure instead of the placeholder 0.
  const overdueReceivables = overdueInvoices.reduce(
    (sum, inv) => sum + (inv.balanceAmount > 0 ? inv.balanceAmount : inv.totalAmount),
    0,
  );
  snapshot.overdueReceivables = overdueReceivables;

  // Deduplication: pull all invoice.overdue events emitted for this org in
  // the last 24h, then parse their payload to extract the invoiceId. Skip
  // any invoice that already has a recent overdue event.
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  let recentOverdueEvents: Array<{ payload: string | null }> = [];
  try {
    recentOverdueEvents = await db.businessEvent.findMany({
      where: {
        businessId: organizationId,
        type: 'invoice.overdue',
        createdAt: { gte: since },
      },
      select: { payload: true },
    });
  } catch (err) {
    // If we can't read existing events, skip dedup and just emit for all
    // overdue invoices (worst case: a duplicate event per day, which the
    // UI collapses sensibly because it groups by type within a session).
    console.warn(
      '[snapshot] detectAndEmitOverdueInvoices: dedup query failed (org=%s):',
      organizationId,
      err instanceof Error ? err.message : err,
    );
  }

  const recentlyEmittedInvoiceIds = new Set<string>();
  for (const ev of recentOverdueEvents) {
    if (!ev.payload) continue;
    try {
      const parsed = JSON.parse(ev.payload) as { metadata?: { invoiceId?: string } };
      const invId = parsed.metadata?.invoiceId;
      if (invId) recentlyEmittedInvoiceIds.add(invId);
    } catch {
      /* ignore malformed payload */
    }
  }

  // Emit one invoice.overdue event per newly-overdue invoice.
  // Each emit is fire-and-forget safe (swallows its own errors).
  await Promise.all(
    overdueInvoices
      .filter((inv) => !recentlyEmittedInvoiceIds.has(inv.id))
      .map((inv) => {
        const amount = inv.balanceAmount > 0 ? inv.balanceAmount : inv.totalAmount;
        const daysOverdue = inv.dueDate
          ? Math.max(
              0,
              Math.floor(
                (Date.now() - new Date(inv.dueDate).getTime()) / (1000 * 60 * 60 * 24),
              ),
            )
          : 0;
        return emitTimelineEvent({
          organizationId,
          type: 'invoice.overdue',
          title: `Invoice ${inv.invoiceNumber} overdue`,
          description: `${inv.buyerName ? `${inv.buyerName} — ` : ''}₹${amount.toLocaleString('en-IN')} unpaid${daysOverdue > 0 ? `, ${daysOverdue} day${daysOverdue === 1 ? '' : 's'} past due.` : '.'}`,
          metadata: {
            invoiceId: inv.id,
            invoiceNumber: inv.invoiceNumber,
            customerId: inv.clientId,
            customerName: inv.buyerName,
            amount,
            totalAmount: inv.totalAmount,
            balanceAmount: inv.balanceAmount,
            dueDate: inv.dueDate,
            daysOverdue,
          },
          severity: daysOverdue > 7 ? 'critical' : 'warning',
        });
      }),
  );
}

// ─── Convenience: empty snapshot (for loading states) ─────────────────────────

export function emptySnapshot(organizationId: string): BusinessSnapshot {
  return {
    organizationId,
    generatedAt: new Date().toISOString(),
    revenue: 0,
    expenses: 0,
    profit: 0,
    cash: 0,
    profitMargin: 0,
    customerCount: 0,
    vendorCount: 0,
    invoiceCount: 0,
    billCount: 0,
    expenseRecordCount: 0,
    receivables: 0,
    payables: 0,
    overdueReceivables: 0,
    overduePayables: 0,
    overdueInvoiceCount: 0,
    outputTax: 0,
    inputTax: 0,
    itcAvailable: 0,
    gstLiability: 0,
    gstCollected: 0,
    totalCollected: 0,
    totalPaid: 0,
    netCashFlow: 0,
    avgDaysToPay: 0,
    filedReturns: 0,
    pendingReturns: 0,
    overdueReturns: 0,
    revenueThisMonth: 0,
    revenueLastMonth: 0,
    topCustomerShare: 0,
    healthScore: 0,
    healthScoreLabel: 'Critical',
    healthScoreFactors: [],
    riskScore: 0,
    riskScoreFactors: [],
    collectionRate: 0,
    workingCapital: 0,
    runwayDays: 0,
    forecast: { nextMonthRevenue: 0, nextMonthExpenses: 0, trend: 'flat', confidence: 0 },
    perEntity: {
      zohoCustomers: 0,
      zohoVendors: 0,
      zohoItems: 0,
      zohoInvoices: 0,
      zohoBills: 0,
      zohoPaymentsReceived: 0,
      zohoPaymentsMade: 0,
      zohoCreditNotes: 0,
      zohoExpenses: 0,
      zohoTaxes: 0,
      zohoJournals: 0,
      zohoBankAccounts: 0,
      zohoBankTransactions: 0,
    },
    lastSyncAt: null,
    lastSyncStatus: 'never',
  };
}

// Re-export the financial engine for pages that need individual calculations
export type { FinancialEngineResult };
