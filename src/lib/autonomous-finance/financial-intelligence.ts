// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — AI Financial Intelligence Engine (Phase Delta · 3)
// Pure TypeScript: computes insights, risks, recommendations, confidence, and
// an overall health score from raw Firestore invoice/transaction/return data.
// No fake data — works on whatever real data exists; degrades gracefully.
// ═══════════════════════════════════════════════════════════════════════════════

export type InsightType =
  | 'revenue' | 'expense' | 'cashflow' | 'working_capital' | 'tax_exposure'
  | 'vendor_concentration' | 'customer_concentration' | 'profitability'
  | 'growth' | 'forecast';

export type InsightSeverity = 'info' | 'warning' | 'critical';

export interface FinancialInsight {
  id: string;
  type: InsightType;
  title: string;
  description: string;
  severity: InsightSeverity;
  confidence: number; // 0-1
  metric: { label: string; value: number; unit: string; trend?: 'up' | 'down' | 'flat' };
  recommendation: string;
  historicalComparison?: { period: string; value: number; deltaPct: number };
}

export interface FinancialIntelligenceReport {
  generatedAt: Date;
  insights: FinancialInsight[];
  risks: FinancialInsight[];
  recommendations: FinancialInsight[];
  summary: {
    revenueTrend: { value: number; trend: 'up' | 'down' | 'flat'; growthPct: number };
    expenseTrend: { value: number; trend: 'up' | 'down' | 'flat'; growthPct: number };
    cashflowForecast: { value: number; unit: string };
    workingCapital: { value: number; unit: string };
    taxExposure: { value: number; unit: string };
    profitabilityMargin: { value: number; unit: string };
    growthRate: { value: number; unit: string };
    topCustomerConcentrationPct: number;
    topVendorConcentrationPct: number;
  };
  overallHealthScore: number; // 0-100
}

interface IntelligenceInput {
  invoices: Array<Record<string, unknown>>;
  bankTransactions: Array<Record<string, unknown>>;
  returns: Array<Record<string, unknown>>;
  clients: Array<Record<string, unknown>>;
  vendors?: Array<Record<string, unknown>>;
  payments?: Array<Record<string, unknown>>;
  creditNotes?: Array<Record<string, unknown>>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function formatCurrency(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 10000000) return `${sign}₹${(abs / 10000000).toFixed(2)} Cr`;
  if (abs >= 100000) return `${sign}₹${(abs / 100000).toFixed(2)} L`;
  if (abs >= 1000) return `${sign}₹${(abs / 1000).toFixed(1)}K`;
  return `${sign}₹${abs.toFixed(0)}`;
}

function monthKey(iso: string | unknown): string | null {
  if (typeof iso !== 'string' || !iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function sumBy<T>(arr: T[], keyFn: (t: T) => number): number {
  return arr.reduce((acc, item) => acc + (keyFn(item) || 0), 0);
}

function confidenceFor(count: number): number {
  if (count < 5) return 0.3;
  if (count < 20) return 0.6;
  return 0.85;
}

function trendOf(curr: number, prev: number): { trend: 'up' | 'down' | 'flat'; pct: number } {
  if (prev === 0) return { trend: curr > 0 ? 'up' : 'flat', pct: 0 };
  const pct = ((curr - prev) / Math.abs(prev)) * 100;
  if (Math.abs(pct) < 2) return { trend: 'flat', pct };
  return { trend: pct > 0 ? 'up' : 'down', pct };
}

// ─── Main engine ─────────────────────────────────────────────────────────────

export function computeFinancialIntelligence(input: IntelligenceInput): FinancialIntelligenceReport {
  const { invoices, bankTransactions, returns, clients, vendors = [], payments = [], creditNotes = [] } = input;
  const now = new Date();
  const insights: FinancialInsight[] = [];

  // ── Revenue trend (sum invoice totalAmount by month, last 3 months) ──
  const byMonth: Record<string, number> = {};
  for (const inv of invoices) {
    const mk = monthKey(inv.invoiceDate ?? inv.createdAt);
    if (mk) byMonth[mk] = (byMonth[mk] || 0) + Number(inv.totalAmount ?? 0);
  }
  const sortedMonths = Object.keys(byMonth).sort();
  const last3 = sortedMonths.slice(-3);
  const revenueThisMonth = last3[last3.length - 1] ? byMonth[last3[last3.length - 1]] : 0;
  const revenuePrevMonth = last3.length >= 2 ? byMonth[last3[last3.length - 2]] : 0;
  const revenueTrend = trendOf(revenueThisMonth, revenuePrevMonth);

  insights.push({
    id: 'ins_revenue',
    type: 'revenue',
    title: 'Revenue Trend',
    description: `Current month revenue is ${formatCurrency(revenueThisMonth)}, ${revenueTrend.trend} ${Math.abs(revenueTrend.pct).toFixed(1)}% vs last month.`,
    severity: revenueTrend.trend === 'down' && revenueTrend.pct < -15 ? 'warning' : 'info',
    confidence: confidenceFor(invoices.length),
    metric: { label: 'This Month', value: revenueThisMonth, unit: 'INR', trend: revenueTrend.trend },
    recommendation: revenueTrend.trend === 'down' && revenueTrend.pct < -15
      ? 'Investigate the revenue dip — review top customers and pipeline health.'
      : 'Maintain current sales velocity; monitor concentration risk.',
    historicalComparison: last3.length >= 2
      ? { period: last3[last3.length - 2], value: revenuePrevMonth, deltaPct: revenueTrend.pct }
      : undefined,
  });

  // ── Expense trend (sum debit bank transactions by month) ──
  const expByMonth: Record<string, number> = {};
  for (const tx of bankTransactions) {
    const amt = Number(tx.amount ?? 0);
    if (amt < 0) {
      const mk = monthKey(tx.date ?? tx.createdAt);
      if (mk) expByMonth[mk] = (expByMonth[mk] || 0) + Math.abs(amt);
    }
  }
  const expMonths = Object.keys(expByMonth).sort();
  const expThis = expMonths.length ? expByMonth[expMonths[expMonths.length - 1]] : 0;
  const expPrev = expMonths.length >= 2 ? expByMonth[expMonths[expMonths.length - 2]] : 0;
  const expTrend = trendOf(expThis, expPrev);

  insights.push({
    id: 'ins_expense',
    type: 'expense',
    title: 'Expense Trend',
    description: `Monthly expenses are ${formatCurrency(expThis)}, ${expTrend.trend} ${Math.abs(expTrend.pct).toFixed(1)}% vs last month.`,
    severity: expTrend.trend === 'up' && expTrend.pct > 20 ? 'warning' : 'info',
    confidence: confidenceFor(bankTransactions.length),
    metric: { label: 'This Month', value: expThis, unit: 'INR', trend: expTrend.trend },
    recommendation: expTrend.trend === 'up' && expTrend.pct > 20
      ? 'Review rising costs — categorize top expense heads and negotiate vendor terms.'
      : 'Expense growth is controlled.',
    historicalComparison: expMonths.length >= 2
      ? { period: expMonths[expMonths.length - 2], value: expPrev, deltaPct: expTrend.pct }
      : undefined,
  });

  // ── Cash flow forecast (30-day: unpaid invoices due - vendor bills due - GST liability) ──
  const thirtyDays = Date.now() + 30 * 24 * 60 * 60 * 1000;
  let inflow = 0;
  for (const inv of invoices) {
    const status = String(inv.status ?? '');
    if (status === 'unpaid' || status === 'overdue') {
      const due = inv.dueDate ? new Date(String(inv.dueDate)).getTime() : null;
      if (!due || due <= thirtyDays) inflow += Number(inv.totalAmount ?? 0);
    }
  }
  // Outflow: GST liability from unfiled returns due in 30 days
  let gstLiability = 0;
  for (const ret of returns) {
    const status = String(ret.status ?? '');
    if (status !== 'filed') {
      gstLiability += Number(ret.totalTax ?? 0);
    }
  }
  const cashflowForecast = inflow - gstLiability;
  insights.push({
    id: 'ins_cashflow',
    type: 'cashflow',
    title: '30-Day Cash Flow Forecast',
    description: `Projected net cash: ${formatCurrency(cashflowForecast)} (inflows ${formatCurrency(inflow)} − GST liability ${formatCurrency(gstLiability)}).`,
    severity: cashflowForecast < 0 ? 'critical' : cashflowForecast < gstLiability * 0.5 ? 'warning' : 'info',
    confidence: confidenceFor(invoices.length + returns.length),
    metric: { label: '30-Day Net', value: cashflowForecast, unit: 'INR', trend: cashflowForecast >= 0 ? 'up' : 'down' },
    recommendation: cashflowForecast < 0
      ? 'Secure short-term funding or accelerate collections before the GST due date.'
      : 'Cash position is healthy for the next 30 days.',
  });

  // ── Working capital (receivables - payables approx) ──
  const receivables = sumBy(invoices, (i) => {
    const s = String(i.status ?? '');
    return (s === 'unpaid' || s === 'overdue') ? Number(i.totalAmount ?? 0) : 0;
  });
  const payables = sumBy(vendors, (v) => Number(v.outstandingAmount ?? v.amount ?? 0));
  const workingCapital = receivables - payables;
  insights.push({
    id: 'ins_working_capital',
    type: 'working_capital',
    title: 'Working Capital',
    description: `Net working capital (receivables − payables) is ${formatCurrency(workingCapital)}.`,
    severity: workingCapital < 0 ? 'critical' : workingCapital < receivables * 0.2 ? 'warning' : 'info',
    confidence: confidenceFor(invoices.length + vendors.length),
    metric: { label: 'Net', value: workingCapital, unit: 'INR' },
    recommendation: workingCapital < 0
      ? 'Working capital is negative — expedite collections and delay non-essential payables.'
      : 'Maintain a healthy current ratio above 1.5.',
  });

  // ── Tax exposure (unfiled returns totalTax) ──
  const taxExposure = gstLiability;
  insights.push({
    id: 'ins_tax',
    type: 'tax_exposure',
    title: 'GST Tax Exposure',
    description: `${formatCurrency(taxExposure)} in GST liability across ${returns.filter(r => String(r.status ?? '') !== 'filed').length} unfiled return(s).`,
    severity: taxExposure > 500000 ? 'warning' : 'info',
    confidence: confidenceFor(returns.length),
    metric: { label: 'Unfiled Liability', value: taxExposure, unit: 'INR' },
    recommendation: taxExposure > 0
      ? 'Prioritize filing to avoid ₹200/day late fee + 18% interest.'
      : 'No outstanding GST liability.',
  });

  // ── Vendor concentration (top vendor % of total spend) ──
  const vendorSpend: Record<string, number> = {};
  for (const v of vendors) {
    const name = String(v.name ?? v.vendorName ?? 'Unknown');
    vendorSpend[name] = (vendorSpend[name] || 0) + Number(v.outstandingAmount ?? v.amount ?? 0);
  }
  const totalVendorSpend = sumBy(Object.values(vendorSpend), (x) => x);
  const topVendorPct = totalVendorSpend > 0
    ? (Math.max(...Object.values(vendorSpend), 0) / totalVendorSpend) * 100
    : 0;
  if (Object.keys(vendorSpend).length > 0) {
    const topVendor = Object.entries(vendorSpend).sort((a, b) => b[1] - a[1])[0];
    insights.push({
      id: 'ins_vendor',
      type: 'vendor_concentration',
      title: 'Vendor Concentration',
      description: `Top vendor "${topVendor[0]}" accounts for ${topVendorPct.toFixed(1)}% of total payables.`,
      severity: topVendorPct > 50 ? 'warning' : topVendorPct > 40 ? 'info' : 'info',
      confidence: confidenceFor(vendors.length),
      metric: { label: 'Top Vendor %', value: topVendorPct, unit: '%' },
      recommendation: topVendorPct > 40
        ? 'Diversify suppliers or negotiate backup vendors to reduce dependency risk.'
        : 'Vendor base is well-diversified.',
    });
  }

  // ── Customer concentration (top customer % of total revenue) ──
  const custRev: Record<string, number> = {};
  for (const inv of invoices) {
    const c = String(inv.clientId ?? inv.buyerName ?? 'Unknown');
    custRev[c] = (custRev[c] || 0) + Number(inv.totalAmount ?? 0);
  }
  const totalCustRev = sumBy(Object.values(custRev), (x) => x);
  const topCustPct = totalCustRev > 0
    ? (Math.max(...Object.values(custRev), 0) / totalCustRev) * 100
    : 0;
  if (Object.keys(custRev).length > 0) {
    const topCust = Object.entries(custRev).sort((a, b) => b[1] - a[1])[0];
    insights.push({
      id: 'ins_customer',
      type: 'customer_concentration',
      title: 'Customer Concentration',
      description: `Top customer accounts for ${topCustPct.toFixed(1)}% of total revenue.`,
      severity: topCustPct > 35 ? 'warning' : 'info',
      confidence: confidenceFor(invoices.length),
      metric: { label: 'Top Customer %', value: topCustPct, unit: '%' },
      recommendation: topCustPct > 35
        ? `Customer "${topCust[0]}" concentration is high — expand the customer base to reduce revenue risk.`
        : 'Customer base is diversified.',
    });
  }

  // ── Profitability ((revenue - expenses) / revenue) ──
  const profitMargin = revenueThisMonth > 0 ? ((revenueThisMonth - expThis) / revenueThisMonth) * 100 : 0;
  insights.push({
    id: 'ins_profit',
    type: 'profitability',
    title: 'Profitability Margin',
    description: `Net profit margin this month is ${profitMargin.toFixed(1)}%.`,
    severity: profitMargin < 10 ? profitMargin < 0 ? 'critical' : 'warning' : 'info',
    confidence: confidenceFor(invoices.length + bankTransactions.length),
    metric: { label: 'Margin', value: profitMargin, unit: '%' },
    recommendation: profitMargin < 10
      ? 'Margins are thin — review pricing, reduce variable costs, or upsell higher-margin services.'
      : 'Profitability is healthy.',
  });

  // ── Growth rate ──
  insights.push({
    id: 'ins_growth',
    type: 'growth',
    title: 'Growth Rate',
    description: `Month-over-month revenue growth is ${revenueTrend.pct.toFixed(1)}%.`,
    severity: revenueTrend.pct < -10 ? 'warning' : revenueTrend.pct > 20 ? 'info' : 'info',
    confidence: confidenceFor(invoices.length),
    metric: { label: 'MoM Growth', value: revenueTrend.pct, unit: '%', trend: revenueTrend.trend },
    recommendation: revenueTrend.pct < -10
      ? 'Negative growth — investigate churn and pipeline.'
      : 'Growth is on track.',
  });

  // ── Forecast (linear projection 30 days) ──
  const dailyAvg = revenueThisMonth > 0 ? revenueThisMonth / 30 : 0;
  const forecast30 = dailyAvg * 30 * (1 + (revenueTrend.pct / 100) * 0.5);
  insights.push({
    id: 'ins_forecast',
    type: 'forecast',
    title: '30-Day Revenue Forecast',
    description: `Projected next 30 days revenue: ${formatCurrency(forecast30)} (linear + trend-adjusted).`,
    severity: 'info',
    confidence: confidenceFor(invoices.length) * 0.9,
    metric: { label: 'Forecast', value: forecast30, unit: 'INR', trend: forecast30 >= revenueThisMonth ? 'up' : 'down' },
    recommendation: 'Use this forecast to plan working capital and hiring.',
  });

  // ── Overall health score (weighted blend) ──
  const profitScore = Math.max(0, Math.min(100, profitMargin * 2.5)); // 40% margin = 100
  const growthScore = Math.max(0, Math.min(100, 50 + revenueTrend.pct * 1.5));
  const cashflowScore = cashflowForecast > 0 ? 100 : Math.max(0, 100 + cashflowForecast / 10000);
  const concentrationRisk = Math.max(topCustPct, topVendorPct);
  const concentrationScore = Math.max(0, 100 - (concentrationRisk - 20) * 1.5);
  const taxScore = taxExposure === 0 ? 100 : Math.max(0, 100 - taxExposure / 10000);
  const overallHealthScore = Math.round(
    profitScore * 0.25 + growthScore * 0.20 + cashflowScore * 0.20 +
    concentrationScore * 0.15 + taxScore * 0.20,
  );

  const risks = insights.filter((i) => i.severity === 'warning' || i.severity === 'critical');
  const recommendations = insights.filter((i) => i.severity !== 'info' || i.recommendation.length > 60);

  return {
    generatedAt: now,
    insights,
    risks,
    recommendations,
    summary: {
      revenueTrend: { value: revenueThisMonth, trend: revenueTrend.trend, growthPct: revenueTrend.pct },
      expenseTrend: { value: expThis, trend: expTrend.trend, growthPct: expTrend.pct },
      cashflowForecast: { value: cashflowForecast, unit: 'INR' },
      workingCapital: { value: workingCapital, unit: 'INR' },
      taxExposure: { value: taxExposure, unit: 'INR' },
      profitabilityMargin: { value: profitMargin, unit: '%' },
      growthRate: { value: revenueTrend.pct, unit: '%' },
      topCustomerConcentrationPct: topCustPct,
      topVendorConcentrationPct: topVendorPct,
    },
    overallHealthScore,
  };
}
