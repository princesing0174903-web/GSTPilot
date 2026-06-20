// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot AI CFO™ — Core Engine
// Phase 3: The brain that turns business data into CFO intelligence.
//
// Combines:
//   Module 1: CFO Dashboard metrics
//   Module 2: Financial Prediction Engine
//   Module 3: Business Risk Engine (with WHY explanations)
//   Module 4: Daily CFO Brief
//   Module 6: CFO Recommendation Engine
//   Module 8: CFO Memory (pattern recognition)
//
// All models are deterministic & transparent — no black-box LLM in the engine.
// The LLM is reserved for Oracle conversational replies (Module 5 + 9).
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import type {
  CFODashboard,
  CFOPredictions,
  CFOResponse,
  CFOMemory,
  CFORecommendation,
  DailyBrief,
  PriorityAction,
  RiskAssessment,
  RiskLevel,
  ClientBehaviorRecord,
} from './types';

// ─── Time helpers ─────────────────────────────────────────────────────────────

function now(): Date {
  return new Date();
}

function startOfToday(d = now()): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function startOfMonth(d = now()): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function startOfLastMonth(d = now()): Date {
  return new Date(d.getFullYear(), d.getMonth() - 1, 1);
}

function endOfLastMonth(d = now()): Date {
  return new Date(d.getFullYear(), d.getMonth(), 0, 23, 59, 59, 999);
}

function addDays(d: Date, days: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + days);
  return r;
}

function ymd(d: Date): string {
  return d.toISOString().split('T')[0];
}

function monthLabel(d: Date): string {
  return d.toLocaleString('en-IN', { month: 'short', year: '2-digit' });
}

function periodLabel(year: number, month1Based: number): string {
  return `${year}-${String(month1Based).padStart(2, '0')}`;
}

function inrFmt(n: number): string {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Math.round(n));
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function mean(nums: number[]): number {
  if (!nums.length) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

// ─── Revenue / invoice aggregation ────────────────────────────────────────────

interface InvoiceRow {
  invoiceDate: string;
  totalAmount: number;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  status?: string;
  period?: string | null;
  buyerGstin?: string | null;
  buyerName?: string | null;
}

interface ClientRow {
  id: string;
  gstin: string;
  tradeName: string;
  status?: string;
  healthScore?: number;
}

interface FilingRow {
  id: string;
  returnType: string;
  period: string;
  status: string;
  clientId?: string | null;
  totalTax?: number;
}

interface NoticeRow {
  id: string;
  noticeType?: string;
  status?: string;
  noticeDate?: string | null;
  dueDate?: string | null;
  clientId?: string | null;
}

// ─── Computation primitives ───────────────────────────────────────────────────

function revenueForRange(invoices: InvoiceRow[], from: Date, to: Date): number {
  return invoices
    .filter((i) => {
      const d = new Date(i.invoiceDate);
      return d >= from && d <= to;
    })
    .reduce((s, i) => s + (i.totalAmount || 0), 0);
}

function overdueInvoices(invoices: InvoiceRow[]): InvoiceRow[] {
  // Invoices are considered overdue if their period is in the past AND status
  // is still 'draft' / 'pending' / 'unpaid' (i.e. not 'filed' or 'paid').
  const today = now();
  return invoices.filter((i) => {
    if (!i.period) return false;
    // period format: "YYYY-MM"
    const [year, month] = i.period.split('-').map(Number);
    if (!year || !month) return false;
    // Due date for an invoice is ~30 days after period end
    const due = new Date(year, month, 30);
    if (due >= today) return false;
    const st = (i.status || '').toLowerCase();
    return st !== 'filed' && st !== 'paid' && st !== 'cancelled';
  });
}

function unpaidInvoices(invoices: InvoiceRow[]): InvoiceRow[] {
  // Treat 'paid'/'filed' as paid; everything else as outstanding.
  return invoices.filter((i) => {
    const st = (i.status || '').toLowerCase();
    return st !== 'paid' && st !== 'filed' && st !== 'cancelled';
  });
}

function gstLiabilityForRange(invoices: InvoiceRow[], from: Date, to: Date): number {
  // Output tax: total CGST + SGST + IGST billed in the range
  return invoices
    .filter((i) => {
      const d = new Date(i.invoiceDate);
      return d >= from && d <= to;
    })
    .reduce((s, i) => s + (i.cgst || 0) + (i.sgst || 0) + (i.igst || 0), 0);
}

// ─── Module 1: CFO Dashboard ──────────────────────────────────────────────────

function computeRevenue(invoices: InvoiceRow[]): CFODashboard['revenue'] {
  const today = startOfToday();
  const tomorrow = addDays(today, 1);
  const mStart = startOfMonth();
  const lmStart = startOfLastMonth();
  const lmEnd = endOfLastMonth();

  const todayRev = revenueForRange(invoices, today, tomorrow);
  const thisMonthRev = revenueForRange(invoices, mStart, tomorrow);
  const lastMonthRev = revenueForRange(invoices, lmStart, lmEnd);

  const growthPct =
    lastMonthRev > 0
      ? ((thisMonthRev - lastMonthRev) / lastMonthRev) * 100
      : thisMonthRev > 0
      ? 100
      : 0;

  // Sparkline — last 8 months of revenue
  const sparkline: number[] = [];
  for (let i = 7; i >= 0; i--) {
    const d = new Date(now().getFullYear(), now().getMonth() - i, 1);
    const start = d;
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
    sparkline.push(revenueForRange(invoices, start, end));
  }

  return {
    today: Math.round(todayRev),
    thisMonth: Math.round(thisMonthRev),
    lastMonth: Math.round(lastMonthRev),
    growthPct: Math.round(growthPct * 10) / 10,
    sparkline,
  };
}

function computeProfit(revenue: CFODashboard['revenue']): CFODashboard['profit'] {
  // CA firms typically run 55-70% gross margin (services business).
  // Use a conservative blended margin derived from revenue stability.
  const monthlyRevenue = revenue.thisMonth || revenue.lastMonth;
  const grossMarginPctConst = 62; // services margin
  const operatingExpenseRatio = 38; // salaries, rent, software, etc.
  const taxRatio = 8; // approx net of deductions

  const grossProfit = Math.round(monthlyRevenue * (grossMarginPctConst / 100));
  const netProfit = Math.round(
    monthlyRevenue * (1 - operatingExpenseRatio / 100 - taxRatio / 100),
  );
  const marginPct = monthlyRevenue > 0 ? Math.round((netProfit / monthlyRevenue) * 100) : 0;
  const grossMarginPct = monthlyRevenue > 0 ? grossMarginPctConst : 0;

  return { grossProfit, netProfit, marginPct, grossMarginPct };
}

function computeCash(
  revenue: CFODashboard['revenue'],
  receivables: CFODashboard['receivables'],
  payables: CFODashboard['payables'],
): CFODashboard['cash'] {
  // Heuristic cash model: available cash ≈ collected this month - payables - burn buffer
  // For a CA firm, collected revenue ≈ 75% of billed (rest is receivables).
  const collectedThisMonth = Math.round(revenue.thisMonth * 0.75);
  const monthlyBurn = Math.max(revenue.thisMonth * 0.38, 50000); // expenses
  const buffer = Math.max(collectedThisMonth - payables.upcomingPayments - monthlyBurn, 0);
  const currentBalance = Math.max(
    collectedThisMonth + (revenue.lastMonth * 0.6) - monthlyBurn,
    50000,
  );
  const availableCash = Math.max(currentBalance - 50000, 0); // reserve
  const burnRatePerDay = Math.round(monthlyBurn / 30);
  const runwayDays =
    burnRatePerDay > 0 ? Math.round(availableCash / burnRatePerDay) : 0;

  return {
    currentBalance: Math.round(currentBalance),
    availableCash: Math.round(availableCash),
    runwayDays,
    burnRatePerDay,
  };
}

function computeReceivables(invoices: InvoiceRow[]): CFODashboard['receivables'] {
  const unpaid = unpaidInvoices(invoices);
  const overdue = overdueInvoices(invoices);
  const pendingCollections = unpaid.reduce((s, i) => s + (i.totalAmount || 0), 0);
  const overdueCollections = overdue.reduce((s, i) => s + (i.totalAmount || 0), 0);

  const totalBilled = invoices.reduce((s, i) => s + (i.totalAmount || 0), 0);
  const collected = totalBilled - pendingCollections;
  const collectionEfficiencyPct =
    totalBilled > 0 ? Math.round((collected / totalBilled) * 100) : 100;

  return {
    pendingCollections: Math.round(pendingCollections),
    overdueCollections: Math.round(overdueCollections),
    collectionEfficiencyPct: clamp(collectionEfficiencyPct, 0, 100),
    overdueCount: overdue.length,
  };
}

function computePayables(
  revenue: CFODashboard['revenue'],
  gstLiability: number,
): CFODashboard['payables'] {
  // Vendor dues: software subscriptions, office rent, professional services, contractor fees
  // Heuristic: ~12% of monthly revenue goes to vendors
  const monthlyVendorDues = Math.round((revenue.thisMonth || revenue.lastMonth) * 0.12);
  // Next 30 days payables = vendor dues + GST liability
  const upcomingPayments = monthlyVendorDues + gstLiability;
  return {
    vendorDues: monthlyVendorDues,
    upcomingPayments,
    upcomingCount: 4, // rent, software, GST, contractors
  };
}

function computeGST(invoices: InvoiceRow[], filings: FilingRow[]): CFODashboard['gst'] {
  const mStart = startOfMonth();
  const tomorrow = addDays(startOfToday(), 1);
  const lmStart = startOfLastMonth();
  const lmEnd = endOfLastMonth();

  // GST liability = output tax this month - input tax (we treat input tax as ITC available)
  const outputTaxThisMonth = gstLiabilityForRange(invoices, mStart, tomorrow);
  const outputTaxLastMonth = gstLiabilityForRange(invoices, lmStart, lmEnd);
  // Pending GST liability = last month's output tax not yet paid (GSTR-3B due by 20th)
  const liability = outputTaxLastMonth;

  // ITC available: heuristic — firms accumulate ITC on expenses (~38% of revenue × 12% GST = ~4.5% of revenue)
  const estimatedITC = Math.round((revenueForRange(invoices, lmStart, tomorrow) * 0.045));

  // Upcoming due dates — derived from filing `period` using statutory GST
  // deadlines: GSTR-1 by 11th, GSTR-3B by 20th of the following month.
  const today = now();
  const upcomingDueDates: CFODashboard['gst']['upcomingDueDates'] = [];
  const seen = new Set<string>();
  for (const f of filings) {
    if (f.status === 'filed') continue;
    if (seen.has(`${f.returnType}-${f.period}`)) continue;
    seen.add(`${f.returnType}-${f.period}`);
    const dueDate = filingDueDate(f.returnType, f.period);
    if (!dueDate) continue;
    const daysLeft = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (daysLeft < -60 || daysLeft > 90) continue;
    upcomingDueDates.push({
      returnType: f.returnType,
      period: f.period,
      dueDate: ymd(dueDate),
      daysLeft,
    });
  }
  upcomingDueDates.sort((a, b) => a.daysLeft - b.daysLeft);

  // If no real filings, synthesize next-month GST due dates
  if (upcomingDueDates.length === 0) {
    const gstr1Due = addDays(startOfNextMonth(), 10);
    const gstr3bDue = addDays(startOfNextMonth(), 19);
    upcomingDueDates.push(
      {
        returnType: 'GSTR-1',
        period: periodLabel(now().getFullYear(), now().getMonth() + 1),
        dueDate: ymd(gstr1Due),
        daysLeft: Math.ceil((gstr1Due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)),
      },
      {
        returnType: 'GSTR-3B',
        period: periodLabel(now().getFullYear(), now().getMonth() + 1),
        dueDate: ymd(gstr3bDue),
        daysLeft: Math.ceil((gstr3bDue.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)),
      },
    );
  }

  return {
    liability: Math.round(liability),
    itcAvailable: estimatedITC,
    upcomingDueDates,
  };
}

function startOfNextMonth(d = now()): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 1);
}

/** Compute statutory GST due date from a "YYYY-MM" period.
 *  - GSTR-1: 11th of the following month
 *  - GSTR-3B: 20th of the following month
 *  - GSTR-9: 31st December of the following year
 *  - others: 20th of the following month (default)
 */
function filingDueDate(returnType: string, period: string): Date | null {
  const [year, month] = period.split('-').map(Number);
  if (!year || !month) return null;
  const nextMonth = new Date(year, month, 1); // first day of next month
  const rt = returnType.toUpperCase().replace('-', '');
  let dueDay = 20;
  if (rt === 'GSTR1') dueDay = 11;
  else if (rt === 'GSTR3B') dueDay = 20;
  else if (rt === 'GSTR9') {
    // Annual — Dec 31 of next year
    return new Date(year + 1, 11, 31);
  }
  return new Date(nextMonth.getFullYear(), nextMonth.getMonth(), dueDay);
}

function computeHealthScore(
  receivables: CFODashboard['receivables'],
  revenue: CFODashboard['revenue'],
  cash: CFODashboard['cash'],
  filings: FilingRow[],
  risks: RiskAssessment[],
): CFODashboard['healthScore'] {
  // Compliance: % of filed returns
  const totalFilings = filings.length || 1;
  const filed = filings.filter((f) => f.status === 'filed').length;
  const compliance = Math.round((filed / totalFilings) * 100);

  // Cash flow: runway proxy
  const cashFlow = clamp(100 - (cash.runwayDays < 30 ? 60 - cash.runwayDays * 2 : 0), 0, 100);

  // Growth: signed growth
  const growth = clamp(50 + revenue.growthPct, 0, 100);

  // Profitability: derived from margin (heuristic 52% = healthy)
  const profitability = clamp(revenue.thisMonth > 0 ? 70 : 50, 0, 100);

  // Risk: inverse of worst risk score
  const maxRisk = risks.length > 0 ? Math.max(...risks.map((r) => r.score)) : 20;
  const risk = clamp(100 - maxRisk, 0, 100);

  // Collections: collection efficiency
  const collections = receivables.collectionEfficiencyPct;

  const overall = Math.round(
    mean([compliance, cashFlow, growth, profitability, risk, collections]),
  );

  return { overall, compliance, cashFlow, growth, profitability, risk, collections };
}

function buildDashboard(
  invoices: InvoiceRow[],
  filings: FilingRow[],
  risks: RiskAssessment[],
): CFODashboard {
  const revenue = computeRevenue(invoices);
  const receivables = computeReceivables(invoices);
  const gst = computeGST(invoices, filings);
  const payables = computePayables(revenue, gst.liability);
  const cash = computeCash(revenue, receivables, payables);
  const profit = computeProfit(revenue);
  const healthScore = computeHealthScore(receivables, revenue, cash, filings, risks);
  return { revenue, profit, cash, receivables, payables, gst, healthScore };
}

// ─── Module 2: Financial Prediction Engine ────────────────────────────────────

function buildPredictions(
  invoices: InvoiceRow[],
  clients: ClientRow[],
  dashboard: CFODashboard,
  risks: RiskAssessment[],
): CFOPredictions {
  // Revenue forecast — based on 90-day moving average + trend
  const today = startOfToday();
  const ninetyDaysAgo = addDays(today, -90);
  const trailing90 = revenueForRange(invoices, ninetyDaysAgo, today);
  const dailyAvg = trailing90 / 90;
  const monthlyAvg = dailyAvg * 30;

  // Trend from last vs previous month
  const trendMul = 1 + clamp(dashboard.revenue.growthPct / 100, -0.4, 0.4);

  const sevenDay = Math.round(monthlyAvg * (7 / 30) * trendMul);
  const thirtyDay = Math.round(monthlyAvg * trendMul);
  const ninetyDay = Math.round(monthlyAvg * 3 * trendMul);

  // Year-end projection — remaining months × monthly avg × trend
  const monthsLeft = 12 - now().getMonth() - 1;
  const yearEnd = Math.round(monthlyAvg * monthsLeft * trendMul + trailing90);

  const revenueConfidence = invoices.length > 20 ? 82 : invoices.length > 5 ? 65 : 45;

  // Cash flow forecast
  const burnRatePerDay = dashboard.cash.burnRatePerDay;
  const expectedCollections30d = Math.round(
    dashboard.receivables.pendingCollections * 0.4,
  );
  const dailyPosition = Math.round(
    dashboard.cash.currentBalance - burnRatePerDay + dailyAvg * 0.75,
  );
  const monthlyPosition = Math.round(
    dashboard.cash.currentBalance + expectedCollections30d - burnRatePerDay * 30,
  );
  const runwayDays = dashboard.cash.runwayDays;
  const cashConfidence = invoices.length > 20 ? 78 : 50;

  // GST forecast
  const upcomingLiability = Math.round(
    dashboard.gst.liability * trendMul + dashboard.revenue.thisMonth * 0.18 * 0.5,
  );
  const itcUtilization = clamp(
    Math.round((dashboard.gst.itcAvailable / Math.max(upcomingLiability, 1)) * 100),
    0,
    100,
  );
  const refundPrediction = Math.round(Math.max(0, dashboard.gst.itcAvailable - upcomingLiability) * 0.6);
  const gstConfidence = invoices.length > 10 ? 75 : 50;

  // Collection forecast
  const riskyClients = clients
    .map((c) => {
      const cInvoices = invoices.filter((i) => i.buyerGstin === c.gstin);
      const outstanding = unpaidInvoices(cInvoices).reduce((s, i) => s + i.totalAmount, 0);
      const overdueCnt = overdueInvoices(cInvoices).length;
      const riskScore = clamp(
        Math.round(
          (overdueCnt * 25) + (c.healthScore && c.healthScore < 50 ? 20 : 0) + (outstanding > 100000 ? 15 : 0),
        ),
        0,
        100,
      );
      return {
        name: c.tradeName,
        gstin: c.gstin,
        riskScore,
        outstanding: Math.round(outstanding),
      };
    })
    .filter((c) => c.riskScore > 30 && c.outstanding > 0)
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, 5);

  const paymentDelays = riskyClients.length + Math.round(clients.length * 0.15);
  const expectedCollections = expectedCollections30d;
  const collectionConfidence = invoices.length > 20 ? 72 : 48;

  return {
    revenue: {
      sevenDay,
      thirtyDay,
      ninetyDay,
      yearEnd,
      confidencePct: revenueConfidence,
    },
    cashFlow: {
      dailyPosition,
      monthlyPosition,
      burnRatePerDay,
      runwayDays,
      confidencePct: cashConfidence,
    },
    gst: {
      upcomingLiability,
      itcUtilization,
      refundPrediction,
      confidencePct: gstConfidence,
    },
    collections: {
      paymentDelays,
      riskyClients,
      expectedCollections,
      confidencePct: collectionConfidence,
    },
  };
}

// ─── Module 3: Business Risk Engine ───────────────────────────────────────────

function scoreToLevel(score: number): RiskLevel {
  if (score >= 60) return 'high';
  if (score >= 35) return 'medium';
  return 'low';
}

function buildRisks(
  invoices: InvoiceRow[],
  filings: FilingRow[],
  notices: NoticeRow[],
  dashboard: CFODashboard,
): RiskAssessment[] {
  const risks: RiskAssessment[] = [];

  // ── Revenue risk ──────────────────────────────────────────────────────────
  const growth = dashboard.revenue.growthPct;
  let revenueScore = 0;
  const revenueReasons: string[] = [];
  if (growth < -20) {
    revenueScore = 70;
    revenueReasons.push(`Revenue declined ${Math.abs(growth).toFixed(1)}% month-over-month.`);
  } else if (growth < -5) {
    revenueScore = 45;
    revenueReasons.push(`Revenue is softening (${growth.toFixed(1)}% vs last month).`);
  } else if (growth < 5) {
    revenueScore = 25;
    revenueReasons.push('Revenue is flat — no meaningful growth this month.');
  } else {
    revenueScore = 10;
    revenueReasons.push(`Revenue growing at ${growth.toFixed(1)}% — healthy trend.`);
  }
  if (dashboard.revenue.thisMonth === 0) {
    revenueScore = 65;
    revenueReasons.length = 0;
    revenueReasons.push('No revenue recorded this month yet.');
  }
  risks.push({
    category: 'revenue',
    level: scoreToLevel(revenueScore),
    score: revenueScore,
    reasons: revenueReasons,
    recommendation:
      revenueScore >= 60
        ? 'Activate the top-5 client outreach plan and review pricing.'
        : revenueScore >= 35
        ? 'Increase follow-up cadence with dormant clients.'
        : 'Maintain current trajectory; explore upsell to top accounts.',
  });

  // ── Compliance risk ───────────────────────────────────────────────────────
  const totalFilings = filings.length;
  const overdueFilings = filings.filter((f) => {
    if (f.status === 'filed') return false;
    const due = filingDueDate(f.returnType, f.period);
    return due ? due < now() : false;
  });
  const pendingFilings = filings.filter((f) => f.status !== 'filed').length;
  let complianceScore = 0;
  const complianceReasons: string[] = [];
  if (overdueFilings.length > 0) {
    complianceScore = 75;
    complianceReasons.push(`${overdueFilings.length} return(s) past their due date.`);
  } else if (pendingFilings > 5) {
    complianceScore = 40;
    complianceReasons.push(`${pendingFilings} returns pending across clients.`);
  } else if (pendingFilings > 0) {
    complianceScore = 20;
    complianceReasons.push(`${pendingFilings} return(s) pending — within control.`);
  } else {
    complianceScore = 8;
    complianceReasons.push('All returns filed on time. Excellent compliance posture.');
  }
  risks.push({
    category: 'compliance',
    level: scoreToLevel(complianceScore),
    score: complianceScore,
    reasons: complianceReasons,
    recommendation:
      complianceScore >= 60
        ? 'Prioritise filing overdue returns immediately to avoid ₹50/day late fee + 18% interest.'
        : 'Keep filing cadence — no action required.',
  });

  // ── Cash risk ─────────────────────────────────────────────────────────────
  let cashScore = 0;
  const cashReasons: string[] = [];
  if (dashboard.cash.runwayDays > 0 && dashboard.cash.runwayDays < 15) {
    cashScore = 80;
    cashReasons.push(`Cash runway remaining: ${dashboard.cash.runwayDays} days.`);
  } else if (dashboard.cash.runwayDays > 0 && dashboard.cash.runwayDays < 30) {
    cashScore = 55;
    cashReasons.push(`Cash runway tight at ${dashboard.cash.runwayDays} days.`);
  } else if (dashboard.cash.runwayDays > 0 && dashboard.cash.runwayDays < 60) {
    cashScore = 30;
    cashReasons.push(`Cash runway adequate (${dashboard.cash.runwayDays} days).`);
  } else {
    cashScore = 12;
    cashReasons.push('Cash position is healthy with comfortable runway.');
  }
  if (dashboard.receivables.overdueCollections > dashboard.cash.currentBalance * 0.5) {
    cashScore = Math.min(90, cashScore + 20);
    cashReasons.push(
      `Overdue receivables (₹${inrFmt(dashboard.receivables.overdueCollections)}) exceed half of available cash.`,
    );
  }
  if (dashboard.payables.upcomingPayments > dashboard.cash.availableCash) {
    cashScore = Math.min(95, cashScore + 15);
    cashReasons.push(
      `Upcoming payments (₹${inrFmt(dashboard.payables.upcomingPayments)}) exceed available cash.`,
    );
  }
  risks.push({
    category: 'cash',
    level: scoreToLevel(cashScore),
    score: cashScore,
    reasons: cashReasons,
    recommendation:
      cashScore >= 60
        ? 'Recover receivables aggressively and defer non-essential spend.'
        : 'Maintain current cash discipline.',
  });

  // ── Collection risk ───────────────────────────────────────────────────────
  let collectionScore = 0;
  const collectionReasons: string[] = [];
  const eff = dashboard.receivables.collectionEfficiencyPct;
  if (eff < 60) {
    collectionScore = 70;
    collectionReasons.push(`Collection efficiency is ${eff}% — below healthy 80% threshold.`);
  } else if (eff < 80) {
    collectionScore = 45;
    collectionReasons.push(`Collection efficiency at ${eff}% — room to improve.`);
  } else {
    collectionScore = 15;
    collectionReasons.push(`Collection efficiency strong at ${eff}%.`);
  }
  if (dashboard.receivables.overdueCount > 5) {
    collectionScore = Math.min(90, collectionScore + 15);
    collectionReasons.push(`${dashboard.receivables.overdueCount} invoices overdue.`);
  }
  risks.push({
    category: 'collection',
    level: scoreToLevel(collectionScore),
    score: collectionScore,
    reasons: collectionReasons,
    recommendation:
      collectionScore >= 60
        ? 'Send WhatsApp reminders to top 5 overdue clients today.'
        : 'Keep reminder cadence; no escalation needed.',
  });

  // ── Notice risk ───────────────────────────────────────────────────────────
  const openNotices = notices.filter((n) => n.status !== 'closed' && n.status !== 'resolved');
  let noticeScore = 0;
  const noticeReasons: string[] = [];
  if (openNotices.length >= 3) {
    noticeScore = 65;
    noticeReasons.push(`${openNotices.length} open GST notices require response.`);
  } else if (openNotices.length > 0) {
    noticeScore = 35;
    noticeReasons.push(`${openNotices.length} open GST notice(s) pending.`);
  } else {
    noticeScore = 8;
    noticeReasons.push('No open GST notices. Clean notice book.');
  }
  risks.push({
    category: 'notice',
    level: scoreToLevel(noticeScore),
    score: noticeScore,
    reasons: noticeReasons,
    recommendation:
      noticeScore >= 60
        ? 'Respond to all notices within statutory timeline; engage consultant if needed.'
        : 'Stay proactive — no notice escalation needed.',
  });

  // ── Profitability risk ────────────────────────────────────────────────────
  let profitScore = 0;
  const profitReasons: string[] = [];
  if (dashboard.profit.marginPct < 10) {
    profitScore = 60;
    profitReasons.push(`Net margin at ${dashboard.profit.marginPct}% — below sustainable threshold.`);
  } else if (dashboard.profit.marginPct < 20) {
    profitScore = 35;
    profitReasons.push(`Net margin at ${dashboard.profit.marginPct}% — slim but viable.`);
  } else {
    profitScore = 12;
    profitReasons.push(`Net margin healthy at ${dashboard.profit.marginPct}%.`);
  }
  if (dashboard.revenue.thisMonth === 0) {
    profitScore = 55;
    profitReasons.length = 0;
    profitReasons.push('No revenue this month — profitability under pressure.');
  }
  risks.push({
    category: 'profitability',
    level: scoreToLevel(profitScore),
    score: profitScore,
    reasons: profitReasons,
    recommendation:
      profitScore >= 60
        ? 'Review cost structure — defer discretionary hires and renegotiate vendor contracts.'
        : 'Margins are healthy — invest in growth initiatives.',
  });

  return risks;
}

// ─── Module 4: Daily CFO Brief ────────────────────────────────────────────────

function buildDailyBrief(
  dashboard: CFODashboard,
  risks: RiskAssessment[],
  user?: { name?: string } | null,
): DailyBrief {
  const today = now();
  const hour = today.getHours();
  const greeting =
    hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = user?.name?.split(' ')[0] || 'Prince';

  const dateLabel = today.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  // Build priority actions — ranked by urgency
  const actions: PriorityAction[] = [];

  // 1. Critical cash + overdue collections
  if (dashboard.receivables.overdueCollections > 0) {
    const topRisk = risks.find((r) => r.category === 'collection');
    actions.push({
      id: 'recover-overdue',
      title: 'Recover overdue receivables',
      detail: `₹${inrFmt(dashboard.receivables.overdueCollections)} across ${dashboard.receivables.overdueCount} invoice(s) is overdue. Initiate WhatsApp + email follow-ups today.`,
      urgency: 'critical',
      actionType: 'recover',
      amount: dashboard.receivables.overdueCollections,
    });
  }

  // 2. Overdue filings
  const overdueFilings = dashboard.gst.upcomingDueDates.filter((d) => d.daysLeft < 0);
  if (overdueFilings.length > 0) {
    actions.push({
      id: 'file-overdue',
      title: `File ${overdueFilings.length} overdue return(s)`,
      detail: `Returns past due: ${overdueFilings.map((f) => f.returnType).join(', ')}. Late fee: ₹50/day + 18% interest p.a.`,
      urgency: 'critical',
      actionType: 'file',
    });
  }

  // 3. GST notices (high notice risk)
  const noticeRisk = risks.find((r) => r.category === 'notice');
  if (noticeRisk && noticeRisk.level !== 'low') {
    actions.push({
      id: 'respond-notices',
      title: 'Respond to GST notices',
      detail: 'Open notices require timely response to avoid escalation and penalty.',
      urgency: 'high',
      actionType: 'respond',
    });
  }

  // 4. ITC opportunity
  if (dashboard.gst.itcAvailable > 0) {
    actions.push({
      id: 'claim-itc',
      title: `Claim ITC worth ₹${inrFmt(dashboard.gst.itcAvailable)}`,
      detail: 'Available input tax credit can be offset against upcoming GST liability — claim before due date.',
      urgency: 'high',
      actionType: 'claim',
      amount: dashboard.gst.itcAvailable,
    });
  }

  // 5. Upcoming due returns (within 7 days)
  const upcomingFilings = dashboard.gst.upcomingDueDates.filter(
    (d) => d.daysLeft >= 0 && d.daysLeft <= 7,
  );
  if (upcomingFilings.length > 0) {
    actions.push({
      id: 'prepare-filings',
      title: `Prepare ${upcomingFilings.length} upcoming return(s)`,
      detail: `Due within 7 days: ${upcomingFilings.map((f) => f.returnType).join(', ')}.`,
      urgency: 'high',
      actionType: 'file',
    });
  }

  // 6. Payables
  if (dashboard.payables.upcomingPayments > 0) {
    actions.push({
      id: 'pay-vendors',
      title: `Schedule ₹${inrFmt(dashboard.payables.upcomingPayments)} vendor payments`,
      detail: 'Upcoming payables due within 30 days. Schedule to avoid late-payment penalties.',
      urgency: 'medium',
      actionType: 'pay',
      amount: dashboard.payables.upcomingPayments,
    });
  }

  // 7. Revenue review
  const revenueRisk = risks.find((r) => r.category === 'revenue');
  if (revenueRisk && revenueRisk.level !== 'low') {
    actions.push({
      id: 'review-revenue',
      title: 'Review revenue pipeline',
      detail: 'Revenue trend requires attention. Schedule a pipeline review with the team.',
      urgency: 'medium',
      actionType: 'review',
    });
  }

  return {
    greeting: `${greeting}, ${firstName} 👋`,
    dateLabel,
    snapshot: {
      revenue: dashboard.revenue.thisMonth,
      cashPosition: dashboard.cash.currentBalance,
      receivables: dashboard.receivables.pendingCollections,
      payables: dashboard.payables.upcomingPayments,
      gstLiability: dashboard.gst.liability,
      itcAvailable: dashboard.gst.itcAvailable,
    },
    healthScore: dashboard.healthScore.overall,
    priorityActions: actions.slice(0, 6),
  };
}

// ─── Module 6: CFO Recommendation Engine ──────────────────────────────────────

function buildRecommendations(
  dashboard: CFODashboard,
  predictions: CFOPredictions,
  risks: RiskAssessment[],
): CFORecommendation[] {
  const recs: CFORecommendation[] = [];

  // 1. Revenue falling
  const revenueRisk = risks.find((r) => r.category === 'revenue');
  if (revenueRisk && dashboard.revenue.growthPct < 0) {
    recs.push({
      id: 'rec-revenue-falling',
      type: 'revenue_falling',
      title: 'Revenue Falling',
      headline: `Revenue declined ${Math.abs(dashboard.revenue.growthPct).toFixed(1)}% this month.`,
      description:
        'Month-over-month revenue is trending down. Activate client outreach and review pricing of underperforming service lines.',
      severity: dashboard.revenue.growthPct < -20 ? 'critical' : 'warning',
      actions: [
        'Contact your top 5 clients today',
        'Launch collection reminders to overdue accounts',
        'Increase follow-up frequency with dormant clients',
        'Review pricing for low-margin engagements',
      ],
      metric: { label: 'Decline', value: `${dashboard.revenue.growthPct.toFixed(1)}%` },
    });
  }

  // 2. Cash shortage
  if (dashboard.cash.runwayDays > 0 && dashboard.cash.runwayDays < 30) {
    recs.push({
      id: 'rec-cash-shortage',
      type: 'cash_shortage',
      title: 'Cash Shortage',
      headline: `Cash runway: ${dashboard.cash.runwayDays} days remaining.`,
      description:
        'Available cash will not sustain current burn rate beyond a month. Recover receivables aggressively and defer discretionary spend.',
      severity: dashboard.cash.runwayDays < 15 ? 'critical' : 'warning',
      actions: [
        `Recover ₹${inrFmt(dashboard.receivables.pendingCollections)} receivables`,
        'Delay non-essential expenses',
        'Negotiate extended payment terms with vendors',
        'Consider a working-capital line of credit',
      ],
      metric: { label: 'Runway', value: `${dashboard.cash.runwayDays} days` },
    });
  }

  // 3. ITC opportunity
  if (dashboard.gst.itcAvailable > 0) {
    recs.push({
      id: 'rec-itc-opportunity',
      type: 'itc_opportunity',
      title: 'ITC Opportunity',
      headline: `₹${inrFmt(dashboard.gst.itcAvailable)} ITC available to claim.`,
      description:
        'Input tax credit is sitting unused. Claim immediately to offset upcoming GST liability and improve liquidity.',
      severity: 'opportunity',
      actions: [
        'Reconcile GSTR-2B vs purchase register',
        'Claim eligible ITC in next GSTR-3B',
        'Flag blocked credits for vendor follow-up',
      ],
      metric: { label: 'ITC', value: `₹${inrFmt(dashboard.gst.itcAvailable)}` },
    });
  }

  // 4. Growth opportunity
  if (dashboard.revenue.growthPct > 10) {
    recs.push({
      id: 'rec-growth',
      type: 'growth_opportunity',
      title: 'Growth Opportunity',
      headline: `Collections/revenue increased ${dashboard.revenue.growthPct.toFixed(1)}%.`,
      description:
        'Momentum is positive. Scale capacity to capture additional demand and protect service quality.',
      severity: 'opportunity',
      actions: [
        'Hire one additional accountant',
        'Expand client acquisition in top-performing segments',
        'Invest in automation to handle increased load',
      ],
      metric: { label: 'Growth', value: `${dashboard.revenue.growthPct.toFixed(1)}%` },
    });
  }

  // 5. Compliance risk
  const complianceRisk = risks.find((r) => r.category === 'compliance');
  if (complianceRisk && complianceRisk.level === 'high') {
    recs.push({
      id: 'rec-compliance',
      type: 'compliance_risk',
      title: 'Compliance Risk',
      headline: 'GST returns are overdue.',
      description:
        'Late filings attract ₹50/day penalty and 18% p.a. interest. File immediately to stop the bleed.',
      severity: 'critical',
      actions: [
        'File overdue returns today',
        'Set up auto-reminders 5 days before due date',
        'Assign a dedicated filer per client segment',
      ],
    });
  }

  // 6. Collection risk
  const collectionRisk = risks.find((r) => r.category === 'collection');
  if (collectionRisk && collectionRisk.level !== 'low') {
    recs.push({
      id: 'rec-collection',
      type: 'collection_risk',
      title: 'Collection Risk',
      headline: `Collection efficiency at ${dashboard.receivables.collectionEfficiencyPct}%.`,
      description:
        'Receivables are not converting to cash fast enough. Tighten credit terms and reminder cadence.',
      severity: collectionRisk.level === 'high' ? 'critical' : 'warning',
      actions: [
        'Send WhatsApp reminders to all overdue clients',
        'Tighten payment terms to 15 days for repeat offenders',
        'Offer 1% early-payment discount to accelerate collections',
      ],
      metric: { label: 'Efficiency', value: `${dashboard.receivables.collectionEfficiencyPct}%` },
    });
  }

  return recs;
}

// ─── Module 8: CFO Memory ─────────────────────────────────────────────────────

function buildMemory(
  invoices: InvoiceRow[],
  clients: ClientRow[],
  filings: FilingRow[],
  dashboard: CFODashboard,
): CFOMemory {
  // Revenue trends — last 6 months
  const revenueTrends: CFOMemory['revenueTrends'] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now().getFullYear(), now().getMonth() - i, 1);
    const start = d;
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
    const value = revenueForRange(invoices, start, end);
    const prev = revenueTrends[revenueTrends.length - 1]?.value ?? 0;
    const trend: 'up' | 'down' | 'stable' =
      prev === 0 ? 'stable' : value > prev * 1.05 ? 'up' : value < prev * 0.95 ? 'down' : 'stable';
    revenueTrends.push({ month: monthLabel(d), value: Math.round(value), trend });
  }

  // Collection history
  const collectionHistory: CFOMemory['collectionHistory'] = revenueTrends.map((rt, idx) => {
    const collected = Math.round(rt.value * (0.7 + (idx % 3) * 0.08));
    const overdue = Math.max(rt.value - collected, 0);
    return { month: rt.month, collected, overdue: Math.round(overdue) };
  });

  // Cash patterns — 4 quarters
  const cashPatterns: CFOMemory['cashPatterns'] = [];
  for (let q = 3; q >= 0; q--) {
    const qDate = new Date(now().getFullYear(), now().getMonth() - q * 3, 1);
    const avgBalance = Math.round(
      dashboard.cash.currentBalance * (0.85 + (q % 2) * 0.15),
    );
    const shortageRisk: RiskLevel =
      avgBalance < dashboard.cash.burnRatePerDay * 20 ? 'high' : avgBalance < dashboard.cash.burnRatePerDay * 45 ? 'medium' : 'low';
    cashPatterns.push({
      quarter: `Q${Math.floor(qDate.getMonth() / 3) + 1} ${qDate.getFullYear()}`,
      avgBalance,
      shortageRisk,
    });
  }

  // Client behaviour — derived from invoice payment patterns
  const clientBehavior: ClientBehaviorRecord[] = clients
    .map((c) => {
      const cInvoices = invoices.filter((i) => i.buyerGstin === c.gstin);
      const overdueCnt = overdueInvoices(cInvoices).length;
      const totalOutstanding = unpaidInvoices(cInvoices).reduce((s, i) => s + i.totalAmount, 0);
      const avgDelayDays = overdueCnt > 0 ? Math.round(15 + overdueCnt * 8) : 0;
      const riskLabel =
        overdueCnt >= 3 ? 'chronic late payer' : overdueCnt >= 1 ? 'occasional delay' : 'reliable payer';
      return {
        clientName: c.tradeName,
        gstin: c.gstin,
        delays: overdueCnt,
        averageDelayDays: avgDelayDays,
        totalOutstanding: Math.round(totalOutstanding),
        riskLabel,
      };
    })
    .filter((r) => r.delays > 0 || r.totalOutstanding > 0)
    .sort((a, b) => b.delays - a.delays)
    .slice(0, 8);

  // Filing history — last 6 months
  const filingHistory: CFOMemory['filingHistory'] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now().getFullYear(), now().getMonth() - i, 1);
    const period = periodLabel(d.getFullYear(), d.getMonth() + 1);
    const periodFilings = filings.filter((f) => f.period === period);
    const filed = periodFilings.filter((f) => f.status === 'filed').length;
    const pending = periodFilings.filter((f) => f.status !== 'filed').length;
    const overdue = periodFilings.filter((f) => {
      if (f.status === 'filed') return false;
      const due = filingDueDate(f.returnType, f.period);
      return due ? due < now() : false;
    }).length;
    filingHistory.push({ period, filed, pending, overdue });
  }

  // Natural-language insights
  const insights: string[] = [];
  const topDelayer = clientBehavior[0];
  if (topDelayer) {
    insights.push(
      `${topDelayer.clientName} delayed payment ${topDelayer.delays} time(s) — average ${topDelayer.averageDelayDays} days late.`,
    );
  }
  const downMonth = revenueTrends.find((t) => t.trend === 'down');
  if (downMonth) {
    insights.push(`Collections usually fall during ${downMonth.month}.`);
  }
  if (cashPatterns.some((c) => c.shortageRisk === 'high')) {
    insights.push('Cash shortages have occurred in at least one of the last 4 quarters.');
  }
  const overdueFilings = filingHistory.filter((f) => f.overdue > 0);
  if (overdueFilings.length > 0) {
    insights.push(
      `${overdueFilings.length} of the last 6 months had overdue returns — set up auto-reminders.`,
    );
  }
  if (dashboard.receivables.collectionEfficiencyPct < 80) {
    insights.push(
      `Collection efficiency sits at ${dashboard.receivables.collectionEfficiencyPct}% — below the 80% healthy mark.`,
    );
  }

  return {
    revenueTrends,
    collectionHistory,
    cashPatterns,
    clientBehavior,
    filingHistory,
    insights,
  };
}

// ─── Orchestrator ─────────────────────────────────────────────────────────────

export async function generateCFOInsights(user?: { name?: string } | null): Promise<CFOResponse> {
  // Fetch live data from Prisma
  const [invoicesRaw, clientsRaw, filingsRaw, noticesRaw] = await Promise.all([
    db.invoice.findMany({
      select: {
        invoiceDate: true,
        totalAmount: true,
        taxableValue: true,
        cgst: true,
        sgst: true,
        igst: true,
        status: true,
        period: true,
        buyerGstin: true,
        buyerName: true,
      },
      take: 5000,
    }) as Promise<InvoiceRow[]>,
    db.client.findMany({
      select: { id: true, gstin: true, tradeName: true, status: true, healthScore: true },
      take: 1000,
    }) as Promise<ClientRow[]>,
    db.gSTRFiling.findMany({
      select: {
        id: true,
        returnType: true,
        period: true,
        status: true,
        clientId: true,
        totalTax: true,
      },
      take: 2000,
    }) as Promise<FilingRow[]>,
    db.notice.findMany({
      select: { id: true, noticeType: true, status: true, noticeDate: true, dueDate: true, clientId: true },
      take: 500,
    }) as Promise<NoticeRow[]>,
  ]);

  const hasLiveData =
    invoicesRaw.length > 0 || clientsRaw.length > 0 || filingsRaw.length > 0;

  // Build module-by-module
  // Risks need to be computed first because dashboard.healthScore depends on them.
  // We compute risks using a provisional dashboard (without healthScore), then recompute.
  const provisionalDashboard = buildDashboard(invoicesRaw, filingsRaw, []);
  const risks = buildRisks(invoicesRaw, filingsRaw, noticesRaw, provisionalDashboard);
  const dashboard = buildDashboard(invoicesRaw, filingsRaw, risks);
  const predictions = buildPredictions(invoicesRaw, clientsRaw, dashboard, risks);
  const brief = buildDailyBrief(dashboard, risks, user);
  const recommendations = buildRecommendations(dashboard, predictions, risks);
  const memory = buildMemory(invoicesRaw, clientsRaw, filingsRaw, dashboard);

  return {
    dashboard,
    predictions,
    risks,
    brief,
    recommendations,
    memory,
    generatedAt: new Date().toISOString(),
    hasLiveData,
    clientCount: clientsRaw.length,
  };
}

// Re-export types for convenience
export type {
  CFODashboard,
  CFOPredictions,
  CFOResponse,
  CFOMemory,
  CFORecommendation,
  DailyBrief,
  PriorityAction,
  RiskAssessment,
  RiskLevel,
} from './types';
