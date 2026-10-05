// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot AI CFO™ — Report Generation Engine (Phase 3, Module 13)
// Generates 10 professional CFO report types:
//   1. Executive Summary     6. Risk Report
//   2. Financial Report      7. Board Report
//   3. Cash Flow Report      8. Monthly CFO Report
//   4. Profit Report         9. Quarterly CFO Report
//   5. GST Report           10. Annual Business Review
//
// Each report produces structured sections (metrics/narrative/table/bullets) that
// the UI renders as a styled document and exports to PDF.
// ═══════════════════════════════════════════════════════════════════════════════

import { generateCFOInsights } from './engine';
import { buildFinancialAnalysis } from './analysis';
import type {
  CFOReport,
  CFOReportSection,
  CFOReportType,
  CFOResponse,
  FinancialAnalysis,
} from './types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function inrShort(n: number): string {
  if (!isFinite(n) || isNaN(n)) return '₹0';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 10000000) return `${sign}₹${(abs / 10000000).toFixed(2)} Cr`;
  if (abs >= 100000) return `${sign}₹${(abs / 100000).toFixed(2)} L`;
  if (abs >= 1000) return `${sign}₹${(abs / 1000).toFixed(1)}K`;
  return sign + '₹' + Math.round(abs).toLocaleString('en-IN');
}

function inrFull(n: number): string {
  if (!isFinite(n) || isNaN(n)) return '₹0';
  const sign = n < 0 ? '-' : '';
  return sign + '₹' + Math.round(Math.abs(n)).toLocaleString('en-IN');
}

function pct(n: number): string {
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(1)}%`;
}

function riskLabel(level: string): string {
  return level === 'high' ? 'High' : level === 'medium' ? 'Medium' : 'Low';
}

function monthYear(d = new Date()): string {
  return d.toLocaleString('en-IN', { month: 'long', year: 'numeric' });
}

function quarterLabel(d = new Date()): string {
  const q = Math.floor(d.getMonth() / 3) + 1;
  return `Q${q} ${d.getFullYear()}`;
}

function currentPeriod(): string {
  return monthYear();
}

// ─── Report metadata ───────────────────────────────────────────────────────────

export const CFO_REPORT_META: Record<CFOReportType, { title: string; subtitle: string }> = {
  executive_summary: { title: 'Executive Summary', subtitle: 'A snapshot of your business health' },
  financial_report: { title: 'Financial Report', subtitle: 'Complete financial performance' },
  cash_flow_report: { title: 'Cash Flow Report', subtitle: 'Liquidity & cash position analysis' },
  profit_report: { title: 'Profit Report', subtitle: 'Profitability & margin analysis' },
  gst_report: { title: 'GST Report', subtitle: 'GST compliance & liability status' },
  risk_report: { title: 'Risk Report', subtitle: 'Business risk assessment' },
  board_report: { title: 'Board Report', subtitle: 'Strategic overview for the board' },
  monthly_cfo: { title: 'Monthly CFO Report', subtitle: 'Month-to-date performance' },
  quarterly_cfo: { title: 'Quarterly CFO Report', subtitle: 'Quarterly performance review' },
  annual_review: { title: 'Annual Business Review', subtitle: 'Year-to-date performance' },
};

// ─── Main generator ────────────────────────────────────────────────────────────

export async function generateCFOReport(
  type: CFOReportType,
  firmName?: string,
): Promise<CFOReport> {
  const meta = CFO_REPORT_META[type];
  const [cfo, analysis] = await Promise.all([
    generateCFOInsights(null),
    buildFinancialAnalysis(),
  ]);

  const sections = buildSections(type, cfo, analysis);

  return {
    type,
    title: meta.title,
    subtitle: meta.subtitle,
    generatedAt: new Date().toISOString(),
    period: periodForType(type),
    sections,
    healthScore: cfo.dashboard.healthScore.overall,
    firmName,
  };
}

function periodForType(type: CFOReportType): string {
  switch (type) {
    case 'monthly_cfo': return monthYear();
    case 'quarterly_cfo': return quarterLabel();
    case 'annual_review': return `FY ${new Date().getFullYear()}`;
    default: return currentPeriod();
  }
}

// ─── Section builders per report type ──────────────────────────────────────────

function buildSections(
  type: CFOReportType,
  cfo: CFOResponse,
  analysis: FinancialAnalysis,
): CFOReportSection[] {
  if (!cfo.hasLiveData && cfo.clientCount === 0) {
    return [{
      title: 'No Business Data Connected',
      narrative: [
        'This report requires connected business data to generate meaningful insights.',
        'Once you add clients, invoices, expenses, and GST filings, GSTPilot Oracle™ will automatically populate this report with live financial intelligence.',
      ],
    }];
  }

  switch (type) {
    case 'executive_summary': return buildExecutiveSummary(cfo, analysis);
    case 'financial_report': return buildFinancialReport(cfo);
    case 'cash_flow_report': return buildCashFlowReport(cfo);
    case 'profit_report': return buildProfitReport(cfo);
    case 'gst_report': return buildGSTReport(cfo);
    case 'risk_report': return buildRiskReport(cfo, analysis);
    case 'board_report': return buildBoardReport(cfo, analysis);
    case 'monthly_cfo': return buildMonthlyCFO(cfo);
    case 'quarterly_cfo': return buildQuarterlyCFO(cfo);
    case 'annual_review': return buildAnnualReview(cfo);
    default: return buildExecutiveSummary(cfo, analysis);
  }
}

// ─── 1. Executive Summary ──────────────────────────────────────────────────────

function buildExecutiveSummary(cfo: CFOResponse, analysis: FinancialAnalysis): CFOReportSection[] {
  const d = cfo.dashboard;
  const topRisks = cfo.risks.filter((r) => r.level !== 'low').slice(0, 3);
  const topRecs = cfo.recommendations.slice(0, 3);

  return [
    {
      title: 'Business Health',
      metrics: [
        { label: 'Overall Health Score', value: `${d.healthScore.overall}/100` },
        { label: 'Compliance', value: `${d.healthScore.compliance}/100` },
        { label: 'Cash Flow', value: `${d.healthScore.cashFlow}/100` },
        { label: 'Growth', value: `${d.healthScore.growth}/100` },
        { label: 'Profitability', value: `${d.healthScore.profitability}/100` },
        { label: 'Risk Level', value: `${d.healthScore.risk}/100` },
      ],
      narrative: [
        `Your business health score is ${d.healthScore.overall}/100, indicating ${d.healthScore.overall >= 75 ? 'strong' : d.healthScore.overall >= 50 ? 'moderate' : 'needs attention'} overall performance.`,
        analysis.criticalCount > 0
          ? `${analysis.criticalCount} critical issue(s) detected that require immediate attention.`
          : 'No critical issues detected this period.',
      ],
    },
    {
      title: 'Key Metrics',
      metrics: [
        { label: 'Revenue (This Month)', value: inrShort(d.revenue.thisMonth), delta: pct(d.revenue.growthPct) },
        { label: 'Net Profit', value: inrShort(d.profit.netProfit) },
        { label: 'Cash Position', value: inrShort(d.cash.currentBalance) },
        { label: 'GST Liability', value: inrShort(d.gst.liability) },
        { label: 'ITC Available', value: inrShort(d.gst.itcAvailable) },
        { label: 'Pending Collections', value: inrShort(d.receivables.pendingCollections) },
      ],
    },
    {
      title: 'Top Risks',
      bullets: topRisks.length > 0
        ? topRisks.map((r) => `${r.category.toUpperCase()} (${riskLabel(r.level)}): ${r.reasons[0] || 'n/a'}${r.recommendation ? ` — ${r.recommendation}` : ''}`)
        : ['No elevated risks detected. Business is operating within safe parameters.'],
    },
    {
      title: 'Recommendations',
      bullets: topRecs.length > 0
        ? topRecs.map((r) => `${r.title}: ${r.headline}`)
        : cfo.brief.priorityActions.slice(0, 3).map((a) => `${a.title}: ${a.detail}`),
    },
  ];
}

// ─── 2. Financial Report ───────────────────────────────────────────────────────

function buildFinancialReport(cfo: CFOResponse): CFOReportSection[] {
  const d = cfo.dashboard;
  return [
    {
      title: 'Revenue Performance',
      metrics: [
        { label: 'Today', value: inrFull(d.revenue.today) },
        { label: 'This Month', value: inrFull(d.revenue.thisMonth) },
        { label: 'Last Month', value: inrFull(d.revenue.lastMonth) },
        { label: 'Growth', value: pct(d.revenue.growthPct) },
      ],
      narrative: [
        `Revenue ${d.revenue.growthPct >= 0 ? 'grew' : 'declined'} ${Math.abs(d.revenue.growthPct).toFixed(1)}% compared to last month.`,
        d.revenue.growthPct < 0
          ? 'Consider reviewing your sales pipeline and customer retention strategies.'
          : 'Maintain momentum by investing in high-performing channels.',
      ],
    },
    {
      title: 'Profitability',
      metrics: [
        { label: 'Gross Profit', value: inrFull(d.profit.grossProfit) },
        { label: 'Net Profit', value: inrFull(d.profit.netProfit) },
        { label: 'Gross Margin', value: `${d.profit.grossMarginPct.toFixed(1)}%` },
        { label: 'Net Margin', value: `${d.profit.marginPct.toFixed(1)}%` },
      ],
    },
    {
      title: 'Balance Sheet Snapshot',
      metrics: [
        { label: 'Cash Balance', value: inrFull(d.cash.currentBalance) },
        { label: 'Available Cash', value: inrFull(d.cash.availableCash) },
        { label: 'Accounts Receivable', value: inrFull(d.receivables.pendingCollections) },
        { label: 'Accounts Payable', value: inrFull(d.payables.vendorDues) },
        { label: 'Working Capital', value: inrFull(d.receivables.pendingCollections - d.payables.vendorDues) },
      ],
    },
    {
      title: 'Revenue Trend (8 months)',
      table: {
        headers: ['Month', 'Revenue'],
        rows: d.revenue.sparkline.map((v, i) => {
          const date = new Date();
          date.setMonth(date.getMonth() - (7 - i));
          return [date.toLocaleString('en-IN', { month: 'short', year: '2-digit' }), inrFull(v)];
        }),
      },
    },
  ];
}

// ─── 3. Cash Flow Report ───────────────────────────────────────────────────────

function buildCashFlowReport(cfo: CFOResponse): CFOReportSection[] {
  const d = cfo.dashboard;
  const p = cfo.predictions.cashFlow;
  return [
    {
      title: 'Cash Position',
      metrics: [
        { label: 'Current Balance', value: inrFull(d.cash.currentBalance) },
        { label: 'Available Cash', value: inrFull(d.cash.availableCash) },
        { label: 'Daily Burn Rate', value: inrFull(d.cash.burnRatePerDay) },
        { label: 'Runway', value: d.cash.runwayDays > 0 ? `${d.cash.runwayDays} days` : 'N/A' },
      ],
      narrative: [
        d.cash.runwayDays > 0 && d.cash.runwayDays < 60
          ? `Warning: Your cash runway is ${d.cash.runwayDays} days. Consider accelerating collections or reducing expenses.`
          : 'Your cash position is healthy with adequate runway.',
      ],
    },
    {
      title: '30-Day Cash Forecast',
      metrics: [
        { label: 'Projected End-of-Month Cash', value: inrFull(p.monthlyPosition) },
        { label: 'Projected Daily Position', value: inrFull(p.dailyPosition) },
        { label: 'Confidence', value: `${p.confidencePct}%` },
      ],
    },
    {
      title: 'Collections & Payables',
      metrics: [
        { label: 'Pending Collections', value: inrFull(d.receivables.pendingCollections) },
        { label: 'Overdue Collections', value: inrFull(d.receivables.overdueCollections) },
        { label: 'Collection Efficiency', value: `${d.receivables.collectionEfficiencyPct.toFixed(0)}%` },
        { label: 'Upcoming Payments (30d)', value: inrFull(d.payables.upcomingPayments) },
        { label: 'Vendor Dues', value: inrFull(d.payables.vendorDues) },
      ],
    },
    {
      title: 'Recommendations',
      bullets: [
        d.receivables.overdueCollections > 0
          ? `Recover ${inrShort(d.receivables.overdueCollections)} in overdue collections — send reminders immediately.`
          : 'Collections are on track — maintain current credit policy.',
        d.payables.upcomingPayments > d.cash.currentBalance
          ? 'Upcoming payments exceed cash balance — arrange short-term financing or delay non-essential spend.'
          : 'Cash sufficient for upcoming payments.',
      ],
    },
  ];
}

// ─── 4. Profit Report ──────────────────────────────────────────────────────────

function buildProfitReport(cfo: CFOResponse): CFOReportSection[] {
  const d = cfo.dashboard;
  return [
    {
      title: 'Profit Summary',
      metrics: [
        { label: 'Gross Profit', value: inrFull(d.profit.grossProfit) },
        { label: 'Net Profit', value: inrFull(d.profit.netProfit) },
        { label: 'Gross Margin', value: `${d.profit.grossMarginPct.toFixed(1)}%` },
        { label: 'Net Margin', value: `${d.profit.marginPct.toFixed(1)}%` },
      ],
      narrative: [
        d.profit.marginPct >= 15
          ? 'Your net margin is strong — above the 15% benchmark for healthy businesses.'
          : d.profit.marginPct >= 5
            ? 'Your net margin is moderate — review cost structure for optimization opportunities.'
            : 'Your net margin is thin — urgent cost optimization or pricing review needed.',
      ],
    },
    {
      title: 'Profit Drivers',
      metrics: [
        { label: 'Revenue', value: inrFull(d.revenue.thisMonth) },
        { label: 'Estimated Expenses', value: inrFull(d.revenue.thisMonth - d.profit.netProfit) },
        { label: 'Monthly Burn Rate', value: inrFull(d.cash.burnRatePerDay * 30) },
      ],
    },
    {
      title: 'Profit Forecast',
      bullets: [
        `7-day revenue projection: ${inrShort(cfo.predictions.revenue.sevenDay)} (${cfo.predictions.revenue.confidencePct}% confidence)`,
        `30-day revenue projection: ${inrShort(cfo.predictions.revenue.thirtyDay)}`,
        `90-day revenue projection: ${inrShort(cfo.predictions.revenue.ninetyDay)}`,
      ],
    },
  ];
}

// ─── 5. GST Report ─────────────────────────────────────────────────────────────

function buildGSTReport(cfo: CFOResponse): CFOReportSection[] {
  const d = cfo.dashboard;
  const p = cfo.predictions.gst;
  return [
    {
      title: 'GST Position',
      metrics: [
        { label: 'Current Liability', value: inrFull(d.gst.liability) },
        { label: 'ITC Available', value: inrFull(d.gst.itcAvailable) },
        { label: 'Net Payable', value: inrFull(Math.max(0, d.gst.liability - d.gst.itcAvailable)) },
        { label: 'Compliance Score', value: `${d.healthScore.compliance}/100` },
      ],
    },
    {
      title: 'Upcoming Filing Due Dates',
      table: d.gst.upcomingDueDates.length > 0
        ? {
            headers: ['Return Type', 'Period', 'Due Date', 'Days Left'],
            rows: d.gst.upcomingDueDates.map((u) => [u.returnType, u.period, u.dueDate, `${u.daysLeft} days`]),
          }
        : undefined,
      narrative: d.gst.upcomingDueDates.length === 0
        ? ['No upcoming GST filing due dates. All returns are up to date.']
        : undefined,
    },
    {
      title: 'GST Forecast',
      metrics: [
        { label: 'Upcoming Liability', value: inrFull(p.upcomingLiability) },
        { label: 'ITC Utilization', value: `${p.itcUtilization}%` },
        { label: 'Expected Refund', value: inrFull(p.refundPrediction) },
        { label: 'Confidence', value: `${p.confidencePct}%` },
      ],
    },
    {
      title: 'ITC Optimization',
      bullets: [
        d.gst.itcAvailable > d.gst.liability
          ? `You have ${inrShort(d.gst.itcAvailable - d.gst.liability)} excess ITC — eligible for refund or carry-forward.`
          : `ITC covers ${(d.gst.liability > 0 ? (d.gst.itcAvailable / d.gst.liability * 100) : 100).toFixed(0)}% of your liability.`,
        'Reconcile GSTR-2B regularly to capture all available ITC.',
      ],
    },
  ];
}

// ─── 6. Risk Report ────────────────────────────────────────────────────────────

function buildRiskReport(cfo: CFOResponse, analysis: FinancialAnalysis): CFOReportSection[] {
  const detected = analysis.conditions.filter((c) => c.detected);
  return [
    {
      title: 'Risk Overview',
      metrics: [
        { label: 'Risk Score', value: `${cfo.dashboard.healthScore.risk}/100 (higher = safer)` },
        { label: 'Conditions Detected', value: `${analysis.detectedCount}/11` },
        { label: 'Critical Issues', value: `${analysis.criticalCount}` },
      ],
      narrative: [
        analysis.criticalCount > 0
          ? `${analysis.criticalCount} critical risk(s) require immediate action.`
          : 'No critical risks detected. Business is operating within acceptable risk parameters.',
      ],
    },
    {
      title: 'Risk Assessment by Category',
      table: cfo.risks.length > 0
        ? {
            headers: ['Category', 'Level', 'Score', 'Reason'],
            rows: cfo.risks.map((r) => [r.category.toUpperCase(), riskLabel(r.level), `${r.score}/100`, r.reasons[0] || 'n/a']),
          }
        : undefined,
      bullets: cfo.risks.length === 0 ? ['No risks assessed — insufficient data.'] : undefined,
    },
    {
      title: 'Detected Conditions',
      bullets: detected.length > 0
        ? detected.map((c) => `[${c.severity.toUpperCase()}] ${c.title}: ${c.description}`)
        : ['No adverse conditions detected across all 11 monitored categories.'],
    },
    {
      title: 'Risk Mitigation Recommendations',
      bullets: cfo.risks
        .filter((r) => r.level !== 'low' && r.recommendation)
        .slice(0, 5)
        .map((r) => `${r.category.toUpperCase()}: ${r.recommendation}`),
    },
  ];
}

// ─── 7. Board Report ───────────────────────────────────────────────────────────

function buildBoardReport(cfo: CFOResponse, analysis: FinancialAnalysis): CFOReportSection[] {
  const d = cfo.dashboard;
  return [
    {
      title: 'Executive Overview',
      narrative: [
        `Business Health Score: ${d.healthScore.overall}/100 (${d.healthScore.overall >= 75 ? 'Strong' : d.healthScore.overall >= 50 ? 'Moderate' : 'At Risk'}).`,
        `Revenue this month: ${inrShort(d.revenue.thisMonth)} (${pct(d.revenue.growthPct)} vs last month).`,
        `Cash position: ${inrShort(d.cash.currentBalance)} with ${d.cash.runwayDays > 0 ? `${d.cash.runwayDays} days runway` : 'stable operations'}.`,
        analysis.criticalCount > 0
          ? `${analysis.criticalCount} critical issue(s) under active management.`
          : 'No critical issues. Business operating smoothly.',
      ],
    },
    {
      title: 'Key Performance Indicators',
      metrics: [
        { label: 'Health Score', value: `${d.healthScore.overall}/100` },
        { label: 'Revenue Growth', value: pct(d.revenue.growthPct) },
        { label: 'Net Margin', value: `${d.profit.marginPct.toFixed(1)}%` },
        { label: 'Compliance', value: `${d.healthScore.compliance}/100` },
        { label: 'Active Clients', value: `${cfo.clientCount}` },
        { label: 'Cash Runway', value: d.cash.runwayDays > 0 ? `${d.cash.runwayDays} days` : 'N/A' },
      ],
    },
    {
      title: 'Strategic Risks',
      bullets: cfo.risks
        .filter((r) => r.level === 'high')
        .slice(0, 3)
        .map((r) => `${r.category.toUpperCase()}: ${r.reasons[0]}${r.recommendation ? ` (Mitigation: ${r.recommendation})` : ''}`),
    },
    {
      title: 'Outlook',
      narrative: [
        `Revenue projection for next 90 days: ${inrShort(cfo.predictions.revenue.ninetyDay)} (${cfo.predictions.revenue.confidencePct}% confidence).`,
        `GST liability forecast: ${inrShort(cfo.predictions.gst.upcomingLiability)}.`,
        d.healthScore.overall >= 70
          ? 'Business is well-positioned for continued growth. Recommend reinvesting in expansion.'
          : 'Business requires operational improvements before scaling. Focus on margin recovery and collections.',
      ],
    },
  ];
}

// ─── 8. Monthly CFO Report ─────────────────────────────────────────────────────

function buildMonthlyCFO(cfo: CFOResponse): CFOReportSection[] {
  const d = cfo.dashboard;
  return [
    {
      title: `${monthYear()} Performance`,
      metrics: [
        { label: 'Revenue', value: inrFull(d.revenue.thisMonth), delta: pct(d.revenue.growthPct) },
        { label: 'Net Profit', value: inrFull(d.profit.netProfit) },
        { label: 'Margin', value: `${d.profit.marginPct.toFixed(1)}%` },
        { label: 'Cash Position', value: inrFull(d.cash.currentBalance) },
      ],
      narrative: [
        d.revenue.growthPct >= 0
          ? `Revenue grew ${d.revenue.growthPct.toFixed(1)}% versus last month, reaching ${inrShort(d.revenue.thisMonth)}.`
          : `Revenue declined ${Math.abs(d.revenue.growthPct).toFixed(1)}% versus last month — review sales pipeline.`,
      ],
    },
    {
      title: 'Highlights',
      bullets: [
        d.healthScore.overall >= 70 ? 'Strong overall business health maintained.' : 'Business health needs attention.',
        d.receivables.collectionEfficiencyPct >= 80 ? 'Collections efficiency above 80%.' : 'Collections efficiency below target — follow up on overdue accounts.',
        d.healthScore.compliance >= 80 ? 'GST compliance on track.' : 'GST compliance needs attention.',
      ],
    },
    {
      title: 'Concerns',
      bullets: [
        ...(d.receivables.overdueCollections > 0 ? [`${inrShort(d.receivables.overdueCollections)} in overdue collections.`] : []),
        ...(d.cash.runwayDays > 0 && d.cash.runwayDays < 60 ? [`Cash runway at ${d.cash.runwayDays} days — below 60-day threshold.`] : []),
        ...(d.gst.upcomingDueDates.length > 0 ? [`${d.gst.upcomingDueDates.length} GST filing(s) due soon.`] : []),
      ],
    },
    {
      title: 'Next Month Outlook',
      narrative: [
        `Projected revenue: ${inrShort(cfo.predictions.revenue.thirtyDay)} (${cfo.predictions.revenue.confidencePct}% confidence).`,
        `Projected cash position: ${inrShort(cfo.predictions.cashFlow.monthlyPosition)}.`,
      ],
    },
  ];
}

// ─── 9. Quarterly CFO Report ───────────────────────────────────────────────────

function buildQuarterlyCFO(cfo: CFOResponse): CFOReportSection[] {
  const d = cfo.dashboard;
  const p = cfo.predictions;
  return [
    {
      title: `${quarterLabel()} Performance`,
      metrics: [
        { label: 'Quarterly Revenue (est.)', value: inrShort(d.revenue.thisMonth * 3) },
        { label: '90-Day Forecast', value: inrShort(p.revenue.ninetyDay) },
        { label: 'Forecast Confidence', value: `${p.revenue.confidencePct}%` },
        { label: 'Health Score', value: `${d.healthScore.overall}/100` },
      ],
      narrative: [
        `Quarter-to-date revenue is approximately ${inrShort(d.revenue.thisMonth * 3)}, based on current monthly run rate.`,
        `90-day revenue projection stands at ${inrShort(p.revenue.ninetyDay)} with ${p.revenue.confidencePct}% confidence.`,
      ],
    },
    {
      title: 'Quarterly Trends',
      bullets: [
        `Revenue trend: ${d.revenue.growthPct >= 0 ? 'Growing' : 'Declining'} (${pct(d.revenue.growthPct)} MoM).`,
        `Cash trajectory: ${p.cashFlow.monthlyPosition >= d.cash.currentBalance ? 'Improving' : 'Declining'}.`,
        `Compliance health: ${d.healthScore.compliance >= 75 ? 'Strong' : 'Needs attention'} (${d.healthScore.compliance}/100).`,
      ],
    },
    {
      title: 'Risk Position',
      metrics: cfo.risks.slice(0, 4).map((r) => ({
        label: r.category.toUpperCase(),
        value: riskLabel(r.level),
      })),
    },
    {
      title: 'Strategic Recommendations',
      bullets: cfo.recommendations.slice(0, 4).map((r) => `${r.title}: ${r.headline}`),
    },
  ];
}

// ─── 10. Annual Business Review ────────────────────────────────────────────────

function buildAnnualReview(cfo: CFOResponse): CFOReportSection[] {
  const d = cfo.dashboard;
  const p = cfo.predictions;
  const year = new Date().getFullYear();
  return [
    {
      title: `FY ${year} Overview`,
      metrics: [
        { label: 'Annual Revenue (YTD)', value: inrShort(d.revenue.thisMonth * 12) },
        { label: 'Year-End Projection', value: inrShort(p.revenue.yearEnd) },
        { label: 'Forecast Confidence', value: `${p.revenue.confidencePct}%` },
        { label: 'Business Health', value: `${d.healthScore.overall}/100` },
      ],
      narrative: [
        `Based on current performance, FY ${year} revenue is projected to reach ${inrShort(p.revenue.yearEnd)}.`,
        `Business health score of ${d.healthScore.overall}/100 indicates ${d.healthScore.overall >= 75 ? 'strong' : d.healthScore.overall >= 50 ? 'stable' : 'at-risk'} annual performance.`,
      ],
    },
    {
      title: 'Annual Financial Summary',
      metrics: [
        { label: 'Annual Revenue (est.)', value: inrFull(d.revenue.thisMonth * 12) },
        { label: 'Annual Profit (est.)', value: inrFull(d.profit.netProfit * 12) },
        { label: 'Annual GST Handled', value: inrFull(d.gst.liability * 12) },
        { label: 'Active Clients', value: `${cfo.clientCount}` },
        { label: 'Avg Monthly Burn', value: inrFull(d.cash.burnRatePerDay * 30) },
        { label: 'Cash Reserves', value: inrFull(d.cash.currentBalance) },
      ],
    },
    {
      title: 'Year in Review',
      bullets: [
        `Revenue growth: ${pct(d.revenue.growthPct)} month-over-month.`,
        `Compliance performance: ${d.healthScore.compliance}/100.`,
        `Collection efficiency: ${d.receivables.collectionEfficiencyPct.toFixed(0)}%.`,
        `Risk management: ${d.healthScore.risk}/100 (higher = safer).`,
      ],
    },
    {
      title: 'Strategic Outlook for Next Year',
      narrative: [
        `Year-end revenue projection: ${inrShort(p.revenue.yearEnd)} (${p.revenue.confidencePct}% confidence).`,
        d.healthScore.overall >= 75
          ? 'Recommend aggressive growth strategy — expand team, enter new markets, and invest in automation.'
          : 'Recommend consolidation strategy — optimize costs, improve collections, and strengthen compliance before scaling.',
      ],
      bullets: cfo.recommendations.slice(0, 3).map((r) => `${r.title}: ${r.description}`),
    },
  ];
}

export type { CFOReport, CFOReportSection, CFOReportType } from './types';
