// ═══════════════════════════════════════════════════════════════════════════════
// Action: Export Report
// ═══════════════════════════════════════════════════════════════════════════════
//
// Queries REAL aggregated data for the requested report type and returns it
// as a structured artifacts table (rendered in the chat). Actual PDF/Excel
// file generation is intentionally out of scope here — the user gets the
// real numbers immediately and can use the module page to download a file.
//
// Report types:
//   • profit_loss    — uses getBusinessSnapshot() (canonical FY snapshot)
//   • balance_sheet  — assets (cash) vs liabilities (payables) snapshot
//   • gst_summary    — db.invoice aggregate (taxableValue + cgst/sgst/igst)
//   • receivables    — invoices where paymentStatus in [unpaid, partial, overdue]
//   • payables       — purchase bills where balance > 0
//   • cashflow       — payments received vs payments made (snapshot.netCashFlow)
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { getBusinessSnapshot } from '@/lib/business/snapshot';
import { emitTimelineEvent } from '@/lib/timeline/emit';
import {
  registerAction,
  inr,
  logActivity,
  type OracleAction,
  type ValidationResult,
  type ActionPreview,
  type ActionResult,
} from '../registry';

const VALID_REPORT_TYPES = ['profit_loss', 'balance_sheet', 'gst_summary', 'receivables', 'payables', 'cashflow'] as const;
const VALID_FORMATS = ['pdf', 'excel', 'csv'] as const;

export const exportReportAction: OracleAction = {
  name: 'exportReport',
  displayName: 'Export Report',
  description: 'Generate a financial report (P&L, balance sheet, GST summary, receivables, payables, cashflow) from live DB data. Returns a structured table — actual PDF/Excel download is handled by the module page.',
  category: 'finance',
  icon: 'BarChart3',
  intentKeywords: [
    'export report', 'generate report', 'download report', 'export pdf', 'export excel',
    'financial report', 'gst report', 'profit loss', 'balance sheet',
  ],
  paramSchema: [
    { key: 'reportType', label: 'Report Type', type: 'enum', required: true, options: [...VALID_REPORT_TYPES], description: 'Which report to generate' },
    { key: 'format', label: 'Format', type: 'enum', required: false, options: [...VALID_FORMATS], description: 'pdf / excel / csv (default: pdf). Note: actual file generation happens on the module page — this action returns the structured data.' },
    { key: 'period', label: 'Period', type: 'string', required: false, description: 'YYYY-MM or YYYY (used for filtering where applicable)' },
  ],

  async validate(args, _orgId): Promise<ValidationResult> {
    const fields: ValidationResult['fields'] = [];
    const errors: string[] = [];
    const warnings: string[] = [];
    const resolvedRefs: Record<string, any> = {};

    // ── Report type ──
    const reportType = String(args.reportType ?? '').toLowerCase();
    if (!VALID_REPORT_TYPES.includes(reportType as any)) {
      fields.push({ key: 'reportType', label: 'Report Type', status: 'error', message: `Must be one of: ${VALID_REPORT_TYPES.join(', ')}`, resolvedValue: reportType });
      errors.push(`Invalid report type "${reportType}". Must be one of: ${VALID_REPORT_TYPES.join(', ')}.`);
    } else {
      fields.push({ key: 'reportType', label: 'Report Type', status: 'ok', resolvedValue: reportType });
      resolvedRefs.reportType = reportType;
    }

    // ── Format ──
    const format = String(args.format ?? 'pdf').toLowerCase();
    if (!VALID_FORMATS.includes(format as any)) {
      fields.push({ key: 'format', label: 'Format', status: 'warn', message: `Unknown — defaulting to "pdf"`, resolvedValue: 'pdf' });
      warnings.push(`Unknown format "${format}" — defaulting to pdf.`);
      resolvedRefs.format = 'pdf';
    } else {
      fields.push({ key: 'format', label: 'Format', status: 'ok', resolvedValue: format });
      resolvedRefs.format = format;
    }

    // ── Period ──
    if (args.period) {
      const period = String(args.period);
      if (!/^\d{4}(-\d{2})?$/.test(period)) {
        fields.push({ key: 'period', label: 'Period', status: 'warn', message: 'Use YYYY or YYYY-MM', resolvedValue: period });
        warnings.push(`Period "${period}" doesn't match YYYY or YYYY-MM — it may be ignored.`);
      } else {
        fields.push({ key: 'period', label: 'Period', status: 'ok', resolvedValue: period });
        resolvedRefs.period = period;
      }
    }

    return { ok: errors.length === 0, fields, errors, warnings, resolvedRefs };
  },

  buildPreview(args, validation): ActionPreview {
    const refs = validation.resolvedRefs ?? {};
    const reportType = refs.reportType ?? String(args.reportType ?? '—');
    const format = refs.format ?? String(args.format ?? 'pdf');
    const period = refs.period ?? (args.period ? String(args.period) : 'current FY');
    return {
      title: `Export ${reportType.replace(/_/g, ' ')} report (${format.toUpperCase()})`,
      fields: [
        { label: 'Report', value: reportType.replace(/_/g, ' '), emphasize: true },
        { label: 'Format', value: format.toUpperCase() },
        { label: 'Period', value: period, emphasize: true },
      ],
      note: 'Real data will be aggregated from the DB and returned as a structured table. The actual file download is handled on the module page.',
    };
  },

  async execute(args, orgId, ctx): Promise<ActionResult> {
    const reportType = VALID_REPORT_TYPES.includes(String(args.reportType).toLowerCase() as any)
      ? (String(args.reportType).toLowerCase() as typeof VALID_REPORT_TYPES[number])
      : 'profit_loss';
    const format = VALID_FORMATS.includes(String(args.format ?? 'pdf').toLowerCase() as any)
      ? (String(args.format ?? 'pdf').toLowerCase() as typeof VALID_FORMATS[number])
      : 'pdf';
    const period = args.period ? String(args.period) : 'current FY';

    const artifact = await buildReportArtifact(reportType, orgId, period).catch((e) => {
      console.error('[exportReport] buildReportArtifact failed:', e);
      return null;
    });

    if (!artifact) {
      return { ok: false, summary: `Failed to generate ${reportType} report. Database error.` };
    }

    await logActivity(orgId, 'report', `Generated ${reportType} report (${format.toUpperCase()}, ${period})`, {
      reportType, format, period, rowCount: artifact.rows?.length ?? 0,
    });

    await emitTimelineEvent({
      organizationId: orgId,
      type: 'report.generated',
      title: `${reportType.replace(/_/g, ' ')} report generated`,
      description: `Format: ${format.toUpperCase()} · period: ${period} · ${artifact.rows?.length ?? 0} rows.`,
      severity: 'info',
      actor: { userId: ctx.userId, userName: ctx.userId },
      metadata: { reportType, format, period, rowCount: artifact.rows?.length ?? 0 },
    });

    return {
      ok: true,
      summary: `✅ Generated **${reportType.replace(/_/g, ' ')}** report for **${period}** (${format.toUpperCase()}). The data is shown below — use the module page to download as a file.`,
      data: { reportType, format, period, rowCount: artifact.rows?.length ?? 0 },
      artifacts: [artifact],
      viewIn: { label: reportType === 'gst_summary' ? 'View in Returns' : 'View in Reports', href: reportType === 'gst_summary' ? '/returns' : '/reports' },
    };
  },
};

// ─── Report builders ─────────────────────────────────────────────────────────

type ReportArtifact = NonNullable<NonNullable<ActionResult['artifacts']>[number]>;

async function buildReportArtifact(
  reportType: typeof VALID_REPORT_TYPES[number],
  orgId: string,
  period: string,
): Promise<ReportArtifact> {
  switch (reportType) {
    case 'profit_loss':
      return buildProfitLoss(orgId, period);
    case 'balance_sheet':
      return buildBalanceSheet(orgId, period);
    case 'gst_summary':
      return buildGstSummary(orgId, period);
    case 'receivables':
      return buildReceivables(orgId);
    case 'payables':
      return buildPayables(orgId);
    case 'cashflow':
      return buildCashflow(orgId, period);
  }
}

async function buildProfitLoss(orgId: string, period: string): Promise<ReportArtifact> {
  const snap = await getBusinessSnapshot(orgId, { forceRefresh: true }).catch(() => null);
  const revenue = snap?.revenue ?? 0;
  const expenses = snap?.expenses ?? 0;
  const profit = snap?.profit ?? revenue - expenses;
  const margin = snap?.profitMargin ?? (revenue > 0 ? profit / revenue : 0);
  return {
    kind: 'table',
    title: `Profit & Loss — ${period}`,
    columns: ['Line Item', 'Amount'],
    rows: [
      { 'Line Item': 'Revenue (invoiced sales)', Amount: inr(revenue) },
      { 'Line Item': 'Operating Expenses + Purchases', Amount: inr(expenses) },
      { 'Line Item': 'Net Profit', Amount: inr(profit) },
      { 'Line Item': 'Profit Margin', Amount: `${(margin * 100).toFixed(1)}%` },
    ],
  };
}

async function buildBalanceSheet(orgId: string, period: string): Promise<ReportArtifact> {
  const snap = await getBusinessSnapshot(orgId, { forceRefresh: true }).catch(() => null);
  const cash = snap?.cash ?? 0;
  const receivables = snap?.receivables ?? 0;
  const payables = snap?.payables ?? 0;
  const assets = cash + receivables;
  const liabilities = payables;
  const equity = assets - liabilities;
  return {
    kind: 'table',
    title: `Balance Sheet (snapshot) — ${period}`,
    columns: ['Section', 'Line Item', 'Amount'],
    rows: [
      { Section: 'Assets', 'Line Item': 'Cash', Amount: inr(cash) },
      { Section: 'Assets', 'Line Item': 'Receivables', Amount: inr(receivables) },
      { Section: 'Assets', 'Line Item': 'Total Assets', Amount: inr(assets) },
      { Section: 'Liabilities', 'Line Item': 'Payables', Amount: inr(payables) },
      { Section: 'Liabilities', 'Line Item': 'Total Liabilities', Amount: inr(liabilities) },
      { Section: 'Equity', 'Line Item': 'Net Equity', Amount: inr(equity) },
    ],
  };
}

async function buildGstSummary(orgId: string, period: string): Promise<ReportArtifact> {
  const where: any = { client: { firmId: orgId } };
  if (/^\d{4}-\d{2}$/.test(period)) {
    where.period = period;
  } else if (/^\d{4}$/.test(period)) {
    where.period = { startsWith: period };
  }
  const agg = await db.invoice.aggregate({
    where,
    _sum: { taxableValue: true, cgst: true, sgst: true, igst: true, cess: true, totalAmount: true },
    _count: true,
  }).catch(() => null);
  const taxable = agg?._sum.taxableValue ?? 0;
  const cgst = agg?._sum.cgst ?? 0;
  const sgst = agg?._sum.sgst ?? 0;
  const igst = agg?._sum.igst ?? 0;
  const cess = agg?._sum.cess ?? 0;
  const totalTax = cgst + sgst + igst + cess;
  const totalAmount = agg?._sum.totalAmount ?? 0;
  return {
    kind: 'table',
    title: `GST Summary — ${period}`,
    columns: ['Component', 'Amount'],
    rows: [
      { Component: 'Invoices', Amount: String(agg?._count ?? 0) },
      { Component: 'Taxable Value', Amount: inr(taxable) },
      { Component: 'CGST', Amount: inr(cgst) },
      { Component: 'SGST', Amount: inr(sgst) },
      { Component: 'IGST', Amount: inr(igst) },
      { Component: 'Cess', Amount: inr(cess) },
      { Component: 'Total Tax', Amount: inr(totalTax) },
      { Component: 'Total Invoice Value', Amount: inr(totalAmount) },
    ],
  };
}

async function buildReceivables(orgId: string): Promise<ReportArtifact> {
  const invoices = await db.invoice.findMany({
    where: { client: { firmId: orgId }, paymentStatus: { in: ['unpaid', 'partial', 'overdue'] } },
    select: { invoiceNumber: true, buyerName: true, totalAmount: true, balanceAmount: true, paymentStatus: true, dueDate: true },
    orderBy: { createdAt: 'desc' },
    take: 50,
  }).catch(() => []);
  const totalOutstanding = invoices.reduce((s, i) => s + (i.balanceAmount ?? 0), 0);
  const rows = invoices.map((i) => ({
    Invoice: i.invoiceNumber,
    Customer: i.buyerName ?? '—',
    Total: inr(i.totalAmount ?? 0),
    Balance: inr(i.balanceAmount ?? 0),
    Status: i.paymentStatus,
    Due: i.dueDate ?? '—',
  }));
  rows.push({ Invoice: 'TOTAL', Customer: '', Total: '', Balance: inr(totalOutstanding), Status: '', Due: '' });
  return {
    kind: 'table',
    title: 'Receivables (open invoices)',
    columns: ['Invoice', 'Customer', 'Total', 'Balance', 'Status', 'Due'],
    rows,
  };
}

async function buildPayables(orgId: string): Promise<ReportArtifact> {
  const bills = await db.purchaseBill.findMany({
    where: { client: { firmId: orgId }, balanceAmount: { gt: 0 } },
    select: { billNumber: true, vendorName: true, totalAmount: true, balanceAmount: true, dueDate: true },
    orderBy: { createdAt: 'desc' },
    take: 50,
  }).catch(() => []);
  const totalOutstanding = bills.reduce((s, b) => s + (b.balanceAmount ?? 0), 0);
  const rows = bills.map((b) => ({
    Bill: b.billNumber ?? '—',
    Vendor: b.vendorName ?? '—',
    Total: inr(b.totalAmount ?? 0),
    Balance: inr(b.balanceAmount ?? 0),
    Due: b.dueDate ?? '—',
  }));
  rows.push({ Bill: 'TOTAL', Vendor: '', Total: '', Balance: inr(totalOutstanding), Due: '' });
  return {
    kind: 'table',
    title: 'Payables (open bills)',
    columns: ['Bill', 'Vendor', 'Total', 'Balance', 'Due'],
    rows,
  };
}

async function buildCashflow(orgId: string, period: string): Promise<ReportArtifact> {
  const snap = await getBusinessSnapshot(orgId, { forceRefresh: true }).catch(() => null);
  const collected = snap?.totalCollected ?? 0;
  const paid = snap?.totalPaid ?? 0;
  const net = snap?.netCashFlow ?? collected - paid;
  return {
    kind: 'table',
    title: `Cash Flow — ${period}`,
    columns: ['Line Item', 'Amount'],
    rows: [
      { 'Line Item': 'Cash In (payments received)', Amount: inr(collected) },
      { 'Line Item': 'Cash Out (payments made)', Amount: inr(paid) },
      { 'Line Item': 'Net Cash Flow', Amount: inr(net) },
      { 'Line Item': 'Current Cash Position', Amount: inr(snap?.cash ?? 0) },
      { 'Line Item': 'Runway (days)', Amount: String(snap?.runwayDays ?? 0) },
    ],
  };
}

registerAction(exportReportAction);
