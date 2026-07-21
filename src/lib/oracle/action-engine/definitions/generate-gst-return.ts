// ═══════════════════════════════════════════════════════════════════════════════
// Action: Generate GST Return (GSTR-1 / GSTR-3B draft)
// ═══════════════════════════════════════════════════════════════════════════════
//
// Migrated from the legacy inline tool in tools.ts into the generic Action Engine.
// Now gets proper validation, rich preview, and refresh-context support.
//
// Aggregates all posted invoices for the given period, computes total taxable
// value + output tax (CGST+SGST+IGST+Cess), and creates a GSTRFiling record in
// draft status. The user reviews it in the Returns page before filing on the
// GST portal.

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

export const generateGSTReturnAction: OracleAction = {
  name: 'generateGSTReturn',
  displayName: 'Generate GST Return',
  description: 'Prepare a draft GSTR-1 or GSTR-3B return for a given period. Aggregates all posted invoices, computes total taxable value + output tax, and creates a GSTRFiling record in draft status.',
  category: 'compliance',
  icon: 'FileText',
  intentKeywords: [
    'generate gst return', 'prepare gst return', 'file gst', 'gst return',
    'gstr-1', 'gstr-3b', 'gstr1', 'gstr3b', 'gst filing',
    'prepare return', 'draft return', 'file return',
  ],
  paramSchema: [
    { key: 'returnType', label: 'Return Type', type: 'enum', required: true, options: ['GSTR-1', 'GSTR-3B'], description: 'GSTR-1 (outward supplies) or GSTR-3B (summary return)' },
    { key: 'period', label: 'Period', type: 'string', required: true, description: 'Month-Year e.g. "07-2025" for July 2025' },
    { key: 'financialYear', label: 'Financial Year', type: 'string', required: false, description: 'FY e.g. "2025-26". Auto-detected if omitted.' },
  ],

  async validate(args, orgId): Promise<ValidationResult> {
    const fields: ValidationResult['fields'] = [];
    const errors: string[] = [];
    const warnings: string[] = [];
    const resolvedRefs: Record<string, any> = {};

    // ── Return type ──
    const returnType = String(args.returnType ?? 'GSTR-1').toUpperCase();
    if (!['GSTR-1', 'GSTR-3B'].includes(returnType)) {
      fields.push({ key: 'returnType', label: 'Return Type', status: 'error', message: `Must be GSTR-1 or GSTR-3B (got "${returnType}")`, resolvedValue: returnType });
      errors.push(`Invalid return type "${returnType}". Use GSTR-1 or GSTR-3B.`);
    } else {
      fields.push({ key: 'returnType', label: 'Return Type', status: 'ok', resolvedValue: returnType });
      resolvedRefs.returnType = returnType;
    }

    // ── Period ──
    const period = String(args.period ?? '').trim();
    if (!period) {
      fields.push({ key: 'period', label: 'Period', status: 'error', message: 'Period is required (MM-YYYY)' });
      errors.push('Period is required. Use MM-YYYY format (e.g. 07-2025).');
    } else {
      const parts = period.split('-');
      const mm = parts[0]?.trim();
      const yyyy = parts[1]?.trim();
      const monthNum = parseInt(mm ?? '', 10);
      const yearNum = parseInt(yyyy ?? '', 10);
      if (!monthNum || !yearNum || monthNum < 1 || monthNum > 12 || parts.length !== 2) {
        fields.push({ key: 'period', label: 'Period', status: 'error', message: `Invalid period "${period}" — use MM-YYYY`, resolvedValue: period });
        errors.push(`Invalid period "${period}". Use MM-YYYY format (e.g. 07-2025).`);
      } else {
        fields.push({ key: 'period', label: 'Period', status: 'ok', resolvedValue: period });
        resolvedRefs.period = period;
        resolvedRefs.monthNum = monthNum;
        resolvedRefs.yearNum = yearNum;

        // Compute date range for the month
        const monthStart = new Date(yearNum, monthNum - 1, 1);
        const monthEnd = new Date(yearNum, monthNum, 0, 23, 59, 59);
        const startDateStr = monthStart.toISOString().slice(0, 10);
        const endDateStr = monthEnd.toISOString().slice(0, 10);
        resolvedRefs.startDateStr = startDateStr;
        resolvedRefs.endDateStr = endDateStr;

        // Auto-detect financial year (Indian FY: April-March)
        const fy = args.financialYear ? String(args.financialYear) : (monthNum >= 4 ? `${yearNum}-${(yearNum + 1).toString().slice(-2)}` : `${yearNum - 1}-${yearNum.toString().slice(-2)}`);
        resolvedRefs.financialYear = fy;
        fields.push({ key: 'financialYear', label: 'Financial Year', status: 'ok', resolvedValue: fy });
      }
    }

    // ── Check invoices exist for this period ──
    if (errors.length === 0) {
      const startDateStr = resolvedRefs.startDateStr;
      const endDateStr = resolvedRefs.endDateStr;
      const invoiceCount = await db.invoice.count({
        where: { client: { firmId: orgId }, invoiceDate: { gte: startDateStr, lte: endDateStr }, status: { not: 'draft' } },
      }).catch(() => 0);

      if (invoiceCount === 0) {
        fields.push({ key: 'period', label: 'Period', status: 'error', message: `No posted invoices found for ${period}`, resolvedValue: period });
        errors.push(`No posted invoices found for ${period}. Generate invoices first, or check the period.`);
      } else {
        // Aggregate totals for the preview
        const invoices = await db.invoice.findMany({
          where: { client: { firmId: orgId }, invoiceDate: { gte: startDateStr, lte: endDateStr }, status: { not: 'draft' } },
          select: { taxableValue: true, cgst: true, sgst: true, igst: true, cess: true, totalAmount: true },
        }).catch(() => []);
        const totalTaxableValue = invoices.reduce((s, i) => s + (i.taxableValue ?? 0), 0);
        const totalCGST = invoices.reduce((s, i) => s + (i.cgst ?? 0), 0);
        const totalSGST = invoices.reduce((s, i) => s + (i.sgst ?? 0), 0);
        const totalIGST = invoices.reduce((s, i) => s + (i.igst ?? 0), 0);
        const totalCess = invoices.reduce((s, i) => s + (i.cess ?? 0), 0);
        const totalTax = totalCGST + totalSGST + totalIGST + totalCess;
        resolvedRefs.invoiceCount = invoiceCount;
        resolvedRefs.totalTaxableValue = totalTaxableValue;
        resolvedRefs.totalTax = totalTax;
        resolvedRefs.taxBreakdown = { cgst: totalCGST, sgst: totalSGST, igst: totalIGST, cess: totalCess };
        fields.push({ key: 'period', label: 'Invoices Found', status: 'ok', message: `${invoiceCount} posted invoice(s), taxable ${inr(totalTaxableValue)}, tax ${inr(totalTax)}`, resolvedValue: `${invoiceCount} invoices` });
      }
    }

    // ── Check for existing filing ──
    if (errors.length === 0) {
      const client = await db.client.findFirst({ where: { firmId: orgId }, select: { id: true, tradeName: true } }).catch(() => null);
      if (!client) {
        fields.push({ key: 'returnType', label: 'Client', status: 'error', message: 'No client found for this organization' });
        errors.push('Cannot generate return: no client found for this organization. Create a customer first.');
      } else {
        resolvedRefs.clientId = client.id;
        resolvedRefs.clientName = client.tradeName;
        const existing = await db.gSTRFiling.findFirst({
          where: { clientId: client.id, returnType: resolvedRefs.returnType, period: resolvedRefs.period },
          select: { id: true, status: true },
        }).catch(() => null);
        if (existing) {
          fields.push({ key: 'returnType', label: 'Existing Filing', status: 'error', message: `${resolvedRefs.returnType} for ${resolvedRefs.period} already exists (status: ${existing.status})`, resolvedValue: existing.status });
          errors.push(`A ${resolvedRefs.returnType} for ${resolvedRefs.period} already exists (status: ${existing.status}). Delete it first if you want to regenerate.`);
        }
      }
    }

    return { ok: errors.length === 0, fields, errors, warnings, resolvedRefs };
  },

  buildPreview(args, validation): ActionPreview {
    const refs = validation.resolvedRefs ?? {};
    const returnType = refs.returnType ?? 'GSTR-1';
    const period = refs.period ?? args.period ?? '';
    const fy = refs.financialYear ?? args.financialYear ?? '';
    const invoiceCount = refs.invoiceCount ?? 0;
    const totalTaxableValue = refs.totalTaxableValue ?? 0;
    const totalTax = refs.totalTax ?? 0;
    const breakdown = refs.taxBreakdown ?? {};
    return {
      title: `Generate ${returnType} draft for ${period}`,
      fields: [
        { label: 'Return Type', value: returnType, emphasize: true },
        { label: 'Period', value: period, emphasize: true },
        { label: 'Financial Year', value: fy },
        { label: 'Invoices', value: String(invoiceCount) },
        { label: 'Total Taxable Value', value: inr(totalTaxableValue), emphasize: true },
        { label: 'Total Output Tax', value: inr(totalTax), emphasize: true },
        { label: 'Tax Breakdown', value: `CGST ${inr(breakdown.cgst ?? 0)} + SGST ${inr(breakdown.sgst ?? 0)} + IGST ${inr(breakdown.igst ?? 0)} + Cess ${inr(breakdown.cess ?? 0)}` },
      ],
      note: 'A GSTRFiling record will be created in draft status. Review it in the Returns page, then file it on the GST portal.',
    };
  },

  async execute(args, orgId, _ctx): Promise<ActionResult> {
    const returnType = String(args.returnType ?? 'GSTR-1').toUpperCase();
    const period = String(args.period);
    const parts = period.split('-');
    const monthNum = parseInt(parts[0], 10);
    const yearNum = parseInt(parts[1], 10);
    const monthStart = new Date(yearNum, monthNum - 1, 1);
    const monthEnd = new Date(yearNum, monthNum, 0, 23, 59, 59);
    const startDateStr = monthStart.toISOString().slice(0, 10);
    const endDateStr = monthEnd.toISOString().slice(0, 10);
    const financialYear = args.financialYear ? String(args.financialYear) : (monthNum >= 4 ? `${yearNum}-${(yearNum + 1).toString().slice(-2)}` : `${yearNum - 1}-${yearNum.toString().slice(-2)}`);

    // Fetch all posted invoices for this period
    const invoices = await db.invoice.findMany({
      where: { client: { firmId: orgId }, invoiceDate: { gte: startDateStr, lte: endDateStr }, status: { not: 'draft' } },
      select: { id: true, invoiceNumber: true, taxableValue: true, cgst: true, sgst: true, igst: true, cess: true, totalAmount: true, buyerName: true, buyerGstin: true },
    }).catch(() => []);

    if (invoices.length === 0) {
      return { ok: false, summary: `No posted invoices found for ${period}. Generate invoices first, or check the period format.` };
    }

    const totalTaxableValue = invoices.reduce((s, i) => s + (i.taxableValue ?? 0), 0);
    const totalCGST = invoices.reduce((s, i) => s + (i.cgst ?? 0), 0);
    const totalSGST = invoices.reduce((s, i) => s + (i.sgst ?? 0), 0);
    const totalIGST = invoices.reduce((s, i) => s + (i.igst ?? 0), 0);
    const totalCess = invoices.reduce((s, i) => s + (i.cess ?? 0), 0);
    const totalTax = totalCGST + totalSGST + totalIGST + totalCess;

    // Find the firm's first client (GSTRFiling requires clientId)
    const client = await db.client.findFirst({ where: { firmId: orgId }, select: { id: true, tradeName: true } }).catch(() => null);
    if (!client) {
      return { ok: false, summary: 'Cannot generate return: no client found for this organization. Create a customer first.' };
    }

    // Create the GSTRFiling record
    const filing = await db.gSTRFiling.create({
      data: {
        clientId: client.id,
        returnType,
        period,
        financialYear,
        status: 'draft',
        totalInvoices: invoices.length,
        readyForFiling: invoices.length,
        totalTaxableValue,
        totalTax,
        jsonPayload: JSON.stringify({
          invoices: invoices.map(i => ({
            invoiceNumber: i.invoiceNumber,
            buyerName: i.buyerName,
            buyerGstin: i.buyerGstin,
            taxableValue: i.taxableValue,
            cgst: i.cgst,
            sgst: i.sgst,
            igst: i.igst,
            total: i.totalAmount,
          })),
        }),
      },
      select: { id: true, returnType: true, period: true, totalTaxableValue: true, totalTax: true, totalInvoices: true },
    }).catch((e) => {
      console.error('[generateGSTReturn] GSTRFiling create failed:', e);
      return null;
    });

    if (!filing) {
      return { ok: false, summary: `Failed to generate ${returnType} for ${period}. Database error.` };
    }

    // Log activity
    await logActivity(orgId, 'gst', `${returnType} draft prepared for ${period}: ${invoices.length} invoices, taxable ${inr(totalTaxableValue)}, tax ${inr(totalTax)}`, {
      filingId: filing.id,
      returnType,
      period,
      invoiceCount: invoices.length,
      totalTaxableValue,
      totalTax,
    });

    return {
      ok: true,
      summary: `✅ Prepared **${returnType}** draft for **${period}**:\n• Invoices: ${filing.totalInvoices}\n• Total taxable value: ${inr(filing.totalTaxableValue)}\n• Total output tax: ${inr(filing.totalTax)} (CGST ${inr(totalCGST)} + SGST ${inr(totalSGST)} + IGST ${inr(totalIGST)} + Cess ${inr(totalCess)})\n\nStatus: **Draft**. Review it in the Returns page, then file it on the GST portal.`,
      data: {
        id: filing.id,
        returnType: filing.returnType,
        period: filing.period,
        totalTaxableValue,
        totalTax,
        invoiceCount: invoices.length,
      },
      artifacts: [{
        kind: 'metric' as const,
        title: `${returnType} ${period} Summary`,
        items: [
          { label: 'Invoices', value: String(invoices.length) },
          { label: 'Taxable Value', value: inr(totalTaxableValue) },
          { label: 'CGST', value: inr(totalCGST) },
          { label: 'SGST', value: inr(totalSGST) },
          { label: 'IGST', value: inr(totalIGST) },
          { label: 'Cess', value: inr(totalCess) },
          { label: 'Total Tax', value: inr(totalTax) },
        ],
      }],
      followUp: { label: 'View returns', prompt: 'Show me my GST returns' },
      viewIn: { label: 'View in Returns', href: '/returns' },
    };
  },

  async refreshContext(_result, orgId): Promise<RefreshedContext> {
    const { defaultRefreshContext } = await import('../engine');
    const ctx = await defaultRefreshContext(orgId);
    try {
      const recentFilings = await db.gSTRFiling.findMany({
        where: { client: { firmId: orgId } },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, returnType: true, period: true, status: true, totalTax: true, totalInvoices: true },
      }).catch(() => []);
      (ctx as any).recentFilings = recentFilings;
    } catch {}
    return ctx;
  },
};

registerAction(generateGSTReturnAction);
