// ═══════════════════════════════════════════════════════════════════════════════
// Action: Generate Report (Executive Report)
// ═══════════════════════════════════════════════════════════════════════════════
//
// NEW action for Oracle Phase 1 — Action Engine.
// Oracle can now generate executive reports (business health, GST summary,
// cashflow analysis, client health, compliance status) and persist them to the
// ExecutiveReport table. The user gets a rich preview before the report is
// generated, and a deep-link to view the finished report.
//
// Report types:
//   • business_health   — overall financial health scorecard
//   • gst_summary       — GST liability, ITC, filing status for a period
//   • cashflow_analysis — money in/out, net flow, runway, trends
//   • client_health     — top customers, overdue, receivables aging
//   • compliance_status — upcoming deadlines, notices, filing gaps

import { db } from '@/lib/db';
import {
  registerAction,
  inr,
  logActivity,
  type OracleAction,
  type ValidationResult,
  type ActionPreview,
  type ActionResult,
  type RefreshedContext,
} from '../registry';
import { getBusinessSnapshot } from '@/lib/business/snapshot';

export const generateReportAction: OracleAction = {
  name: 'generateReport',
  displayName: 'Generate Report',
  description: 'Generate an executive report (business health, GST summary, cashflow, client health, compliance status). Aggregates live data and persists an ExecutiveReport record.',
  category: 'operations',
  icon: 'BarChart3',
  intentKeywords: [
    'generate report', 'create report', 'build report', 'make report',
    'executive report', 'business report', 'financial report',
    'gst summary', 'cashflow report', 'cash flow report',
    'client health report', 'compliance report',
    'health report', 'performance report', 'summary report',
  ],
  paramSchema: [
    { key: 'reportType', label: 'Report Type', type: 'enum', required: true, options: ['business_health', 'gst_summary', 'cashflow_analysis', 'client_health', 'compliance_status'], description: 'Type of executive report to generate' },
    { key: 'period', label: 'Period', type: 'string', required: false, description: 'Month-Year e.g. "07-2025", or "Q1-2025" for quarter. Defaults to current month.' },
    { key: 'format', label: 'Format', type: 'enum', required: false, options: ['pdf', 'json', 'csv'], description: 'Default: pdf' },
  ],

  async validate(args, orgId): Promise<ValidationResult> {
    const fields: ValidationResult['fields'] = [];
    const errors: string[] = [];
    const warnings: string[] = [];
    const resolvedRefs: Record<string, any> = {};

    // ── Report type ──
    const validTypes = ['business_health', 'gst_summary', 'cashflow_analysis', 'client_health', 'compliance_status'];
    const reportType = String(args.reportType ?? '').toLowerCase();
    if (!reportType) {
      fields.push({ key: 'reportType', label: 'Report Type', status: 'error', message: 'Report type is required' });
      errors.push('Report type is required.');
    } else if (!validTypes.includes(reportType)) {
      fields.push({ key: 'reportType', label: 'Report Type', status: 'error', message: `Must be one of: ${validTypes.join(', ')}`, resolvedValue: reportType });
      errors.push(`Invalid report type "${reportType}". Choose from: ${validTypes.join(', ')}.`);
    } else {
      const labels: Record<string, string> = {
        business_health: 'Business Health Scorecard',
        gst_summary: 'GST Summary',
        cashflow_analysis: 'Cashflow Analysis',
        client_health: 'Client Health Report',
        compliance_status: 'Compliance Status',
      };
      fields.push({ key: 'reportType', label: 'Report Type', status: 'ok', message: labels[reportType], resolvedValue: labels[reportType] });
      resolvedRefs.reportType = reportType;
      resolvedRefs.reportLabel = labels[reportType];
    }

    // ── Period (optional, default to current month) ──
    let period = String(args.period ?? '').trim();
    if (!period) {
      const now = new Date();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const yyyy = now.getFullYear();
      period = `${mm}-${yyyy}`;
      fields.push({ key: 'period', label: 'Period', status: 'ok', message: `Defaulting to current month (${period})`, resolvedValue: period });
      warnings.push(`No period specified — defaulting to current month (${period}).`);
    } else {
      // Validate MM-YYYY format
      const parts = period.split('-');
      if (parts.length === 2) {
        const monthNum = parseInt(parts[0], 10);
        const yearNum = parseInt(parts[1], 10);
        if (monthNum >= 1 && monthNum <= 12 && yearNum >= 2000 && yearNum <= 2100) {
          fields.push({ key: 'period', label: 'Period', status: 'ok', resolvedValue: period });
        } else {
          fields.push({ key: 'period', label: 'Period', status: 'warn', message: `Unusual period format "${period}" — will use as-is`, resolvedValue: period });
          warnings.push(`Period "${period}" doesn't look like MM-YYYY — will use as-is.`);
        }
      } else {
        fields.push({ key: 'period', label: 'Period', status: 'warn', message: `Custom period "${period}" — will use as-is`, resolvedValue: period });
      }
    }
    resolvedRefs.period = period;

    // ── Format ──
    const format = String(args.format ?? 'pdf').toLowerCase();
    if (!['pdf', 'json', 'csv'].includes(format)) {
      fields.push({ key: 'format', label: 'Format', status: 'warn', message: `Unknown format "${format}" — defaulting to pdf`, resolvedValue: 'pdf' });
      warnings.push(`Unknown format — defaulting to pdf.`);
      resolvedRefs.format = 'pdf';
    } else {
      fields.push({ key: 'format', label: 'Format', status: 'ok', resolvedValue: format });
      resolvedRefs.format = format;
    }

    // ── Check data availability via business snapshot ──
    if (errors.length === 0) {
      try {
        const snapshot = await getBusinessSnapshot(orgId);
        if (!snapshot) {
          fields.push({ key: 'reportType', label: 'Data', status: 'warn', message: 'Limited business data available — report may be sparse', resolvedValue: 'Limited' });
          warnings.push('Business snapshot returned no data — the report will be sparse. Generate invoices/customers first.');
        } else {
          const metrics = snapshot.metrics ?? snapshot;
          const revenue = metrics.totalRevenue ?? metrics.revenue ?? 0;
          const invoiceCount = metrics.invoiceCount ?? metrics.totalInvoices ?? 0;
          const customerCount = metrics.customerCount ?? metrics.totalCustomers ?? 0;
          fields.push({
            key: 'reportType',
            label: 'Data Available',
            status: 'ok',
            message: `${invoiceCount} invoices, ${customerCount} customers, revenue ${inr(revenue)}`,
            resolvedValue: `${invoiceCount} invoices`,
          });
          resolvedRefs.snapshot = snapshot;
          resolvedRefs.invoiceCount = invoiceCount;
          resolvedRefs.customerCount = customerCount;
          resolvedRefs.revenue = revenue;
        }
      } catch (e) {
        fields.push({ key: 'reportType', label: 'Data', status: 'warn', message: 'Could not pre-load snapshot — report will be generated from raw queries', resolvedValue: 'Raw' });
        warnings.push('Could not pre-load business snapshot — report will use raw database queries.');
      }
    }

    return { ok: errors.length === 0, fields, errors, warnings, resolvedRefs };
  },

  buildPreview(args, validation): ActionPreview {
    const refs = validation.resolvedRefs ?? {};
    const reportLabel = refs.reportLabel ?? args.reportType ?? 'Report';
    const period = refs.period ?? args.period ?? 'current month';
    const format = refs.format ?? 'pdf';
    const invoiceCount = refs.invoiceCount ?? 0;
    const customerCount = refs.customerCount ?? 0;
    const revenue = refs.revenue ?? 0;
    return {
      title: `Generate ${reportLabel} for ${period}`,
      fields: [
        { label: 'Report', value: reportLabel, emphasize: true },
        { label: 'Period', value: period, emphasize: true },
        { label: 'Format', value: format.toUpperCase() },
        { label: 'Data Source', value: `${invoiceCount} invoices, ${customerCount} customers` },
        { label: 'Revenue (period)', value: inr(revenue) },
      ],
      note: 'An ExecutiveReport record will be created with the aggregated data. The report will be available in the Reports page.',
    };
  },

  async execute(args, orgId, _ctx): Promise<ActionResult> {
    const reportType = String(args.reportType);
    const period = String(args.period ?? (() => {
      const now = new Date();
      return `${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`;
    })());
    const format = String(args.format ?? 'pdf');

    const labels: Record<string, string> = {
      business_health: 'Business Health Scorecard',
      gst_summary: 'GST Summary',
      cashflow_analysis: 'Cashflow Analysis',
      client_health: 'Client Health Report',
      compliance_status: 'Compliance Status',
    };

    // ── Aggregate report data based on type ──
    let reportData: Record<string, any> = {};
    let summaryText = '';

    try {
      const snapshot = await getBusinessSnapshot(orgId).catch(() => null);
      const metrics = snapshot?.metrics ?? snapshot ?? {};

      switch (reportType) {
        case 'business_health': {
          const revenue = metrics.totalRevenue ?? metrics.revenue ?? 0;
          const expenses = metrics.totalExpenses ?? metrics.expenses ?? 0;
          const receivables = metrics.totalReceivables ?? metrics.receivables ?? 0;
          const netProfit = revenue - expenses;
          const margin = revenue > 0 ? (netProfit / revenue) * 100 : 0;
          reportData = {
            revenue, expenses, receivables, netProfit, margin,
            healthScore: margin > 20 ? 'healthy' : margin > 0 ? 'moderate' : 'at-risk',
            customerCount: metrics.customerCount ?? metrics.totalCustomers ?? 0,
            invoiceCount: metrics.invoiceCount ?? metrics.totalInvoices ?? 0,
          };
          summaryText = `Revenue ${inr(revenue)}, Expenses ${inr(expenses)}, Net ${inr(netProfit)} (${margin.toFixed(1)}% margin), Receivables ${inr(receivables)}. Health: ${reportData.healthScore}.`;
          break;
        }
        case 'gst_summary': {
          // Parse period for GST query
          const parts = period.split('-');
          const monthNum = parseInt(parts[0], 10);
          const yearNum = parseInt(parts[1], 10);
          let gstData: any = { period, outputTax: 0, taxableValue: 0, invoiceCount: 0 };
          if (monthNum && yearNum) {
            const monthStart = new Date(yearNum, monthNum - 1, 1);
            const monthEnd = new Date(yearNum, monthNum, 0, 23, 59, 59);
            const startDateStr = monthStart.toISOString().slice(0, 10);
            const endDateStr = monthEnd.toISOString().slice(0, 10);
            const invoices = await db.invoice.findMany({
              where: { client: { firmId: orgId }, invoiceDate: { gte: startDateStr, lte: endDateStr }, status: { not: 'draft' } },
              select: { taxableValue: true, cgst: true, sgst: true, igst: true, cess: true },
            }).catch(() => []);
            gstData = {
              period,
              outputTax: invoices.reduce((s, i) => s + (i.cgst ?? 0) + (i.sgst ?? 0) + (i.igst ?? 0) + (i.cess ?? 0), 0),
              taxableValue: invoices.reduce((s, i) => s + (i.taxableValue ?? 0), 0),
              invoiceCount: invoices.length,
            };
          }
          reportData = gstData;
          summaryText = `${period}: ${gstData.invoiceCount} invoices, taxable ${inr(gstData.taxableValue)}, output tax ${inr(gstData.outputTax)}.`;
          break;
        }
        case 'cashflow_analysis': {
          const revenue = metrics.totalRevenue ?? metrics.revenue ?? 0;
          const expenses = metrics.totalExpenses ?? metrics.expenses ?? 0;
          const cash = metrics.cashBalance ?? metrics.cash ?? 0;
          const netFlow = revenue - expenses;
          const runway = expenses > 0 ? Math.ceil(cash / (expenses / 12)) : 999;
          reportData = {
            revenue, expenses, cash, netFlow, runway,
            collectionRate: revenue > 0 ? ((revenue - (metrics.totalReceivables ?? 0)) / revenue) * 100 : 0,
          };
          summaryText = `Inflow ${inr(revenue)}, Outflow ${inr(expenses)}, Net ${inr(netFlow)}, Cash ${inr(cash)}, Runway ${runway} months.`;
          break;
        }
        case 'client_health': {
          const clients = await db.client.findMany({
            where: { firmId: orgId },
            select: { id: true, tradeName: true, gstin: true, status: true, invoices: { select: { totalAmount: true, balanceAmount: true, paymentStatus: true } } },
            take: 50,
          }).catch(() => []);
          const overdueClients = clients.filter(c => c.invoices.some(i => i.paymentStatus === 'overdue'));
          const totalReceivables = clients.reduce((s, c) => s + c.invoices.reduce((s2, i) => s2 + (i.balanceAmount ?? 0), 0), 0);
          reportData = {
            totalClients: clients.length,
            activeClients: clients.filter(c => c.status === 'active').length,
            overdueClients: overdueClients.length,
            totalReceivables,
            topClients: clients
              .map(c => ({ name: c.tradeName, revenue: c.invoices.reduce((s, i) => s + i.totalAmount, 0) }))
              .sort((a, b) => b.revenue - a.revenue)
              .slice(0, 5),
          };
          summaryText = `${clients.length} clients (${overdueClients.length} overdue), receivables ${inr(totalReceivables)}.`;
          break;
        }
        case 'compliance_status': {
          const filings = await db.gSTRFiling.findMany({
            where: { client: { firmId: orgId } },
            select: { returnType: true, period: true, status: true, totalTax: true },
            orderBy: { createdAt: 'desc' },
            take: 20,
          }).catch(() => []);
          const notices = await db.notice.findMany({
            where: { firmId: orgId },
            select: { id: true, title: true, severity: true, status: true },
            orderBy: { createdAt: 'desc' },
            take: 10,
          }).catch(() => []);
          reportData = {
            totalFilings: filings.length,
            pendingFilings: filings.filter(f => f.status === 'draft' || f.status === 'pending').length,
            filedFilings: filings.filter(f => f.status === 'filed').length,
            totalTaxLiability: filings.reduce((s, f) => s + (f.totalTax ?? 0), 0),
            activeNotices: notices.filter(n => n.status !== 'resolved' && n.status !== 'dismissed').length,
            recentNotices: notices.slice(0, 5),
          };
          summaryText = `${filings.length} filings (${reportData.pendingFilings} pending), ${reportData.activeNotices} active notices, tax liability ${inr(reportData.totalTaxLiability)}.`;
          break;
        }
      }
    } catch (e) {
      console.warn('[generateReport] data aggregation failed:', (e as Error).message);
      reportData = { error: 'Partial data — aggregation incomplete', period };
      summaryText = 'Report generated with partial data due to an aggregation error.';
    }

    // ── Create the ExecutiveReport record ──
    const title = `${labels[reportType]} — ${period}`;
    const description = summaryText;
    const report = await db.executiveReport.create({
      data: {
        reportType,
        title,
        description,
        period,
        data: JSON.stringify(reportData),
        format,
        status: 'generated',
        generatedBy: 'oracle_action_engine',
      },
      select: { id: true, title: true, reportType: true, period: true },
    }).catch((e) => {
      console.error('[generateReport] ExecutiveReport create failed:', e);
      return null;
    });

    if (!report) {
      return { ok: false, summary: `Failed to generate ${labels[reportType]} report. Database error.` };
    }

    // Log activity
    await logActivity(orgId, 'report', `Generated ${labels[reportType]} for ${period}: ${summaryText}`, {
      reportId: report.id,
      reportType,
      period,
    });

    return {
      ok: true,
      summary: `✅ Generated **${labels[reportType]}** for **${period}**:\n\n${summaryText}\n\nThe report has been saved to the Reports page. ${format === 'pdf' ? 'A PDF version is available for download.' : `Format: ${format.toUpperCase()}.`}`,
      data: {
        id: report.id,
        title: report.title,
        reportType: report.reportType,
        period: report.period,
        summary: summaryText,
      },
      artifacts: [{
        kind: 'metric' as const,
        title: labels[reportType],
        items: Object.entries(reportData)
          .filter(([k]) => !['topClients', 'recentNotices'].includes(k))
          .slice(0, 6)
          .map(([k, v]) => ({
            label: k.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase()),
            value: typeof v === 'number' && k.toLowerCase().includes('tax') || k.toLowerCase().includes('revenue') || k.toLowerCase().includes('receivable') || k.toLowerCase().includes('cash') || k.toLowerCase().includes('flow') || k.toLowerCase().includes('liability') ? inr(v as number) : String(v),
          })),
      }],
      followUp: { label: 'View reports', prompt: 'Show me my recent reports' },
      viewIn: { label: 'View in Reports', href: '/reports' },
    };
  },

  async refreshContext(_result, orgId): Promise<RefreshedContext> {
    const { defaultRefreshContext } = await import('../engine');
    const ctx = await defaultRefreshContext(orgId);
    try {
      const recentReports = await db.executiveReport.findMany({
        where: { generatedBy: 'oracle_action_engine' },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, title: true, reportType: true, period: true, status: true },
      }).catch(() => []);
      (ctx as any).recentReports = recentReports;
    } catch {}
    return ctx;
  },
};

registerAction(generateReportAction);
