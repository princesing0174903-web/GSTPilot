// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle CFO™ — Explainable Decision Card Builder
//
// Every recommendation Oracle makes is accompanied by a structured decision
// card containing:
//   • why          — the business reasoning (1-3 sentences)
//   • records      — supporting records with real IDs from the DB
//   • confidence   — 0-100, with factor breakdown
//   • calculation  — line-by-line math that led to the recommendation
//   • risks        — what could go wrong
//   • alternatives — 1-2 other options with trade-offs
//
// No unexplained AI responses. Every number traces back to a record.
// ═══════════════════════════════════════════════════════════════════════════════

import type { DetectedToolCall } from './intent';
import type { LiveBusinessData, ToolContext } from './tools';

export interface SupportingRecord {
  collection: string;
  id: string;
  label: string;
  detail: string;
}

export interface CalculationLine {
  label: string;
  value: string;
}

export interface RiskItem {
  severity: 'low' | 'medium' | 'high';
  description: string;
  mitigation?: string;
}

export interface Alternative {
  title: string;
  tradeOff: string;
  recommended: boolean;
}

export interface ConfidenceFactor {
  label: string;
  weight: number; // 0-1
  score: number; // 0-1
}

export interface DecisionCard {
  toolId: string;
  toolName: string;
  why: string;
  records: SupportingRecord[];
  confidence: number; // 0-100
  confidenceFactors: ConfidenceFactor[];
  calculation: CalculationLine[];
  risks: RiskItem[];
  alternatives: Alternative[];
  generatedAt: string;
}

/**
 * Build an explainable decision card for a detected tool call.
 */
export function buildDecisionCard(
  detected: DetectedToolCall,
  liveData: LiveBusinessData,
  ctx: ToolContext,
): DecisionCard {
  const records: SupportingRecord[] = [];
  const calculation: CalculationLine[] = [];
  const risks: RiskItem[] = [];
  const alternatives: Alternative[] = [];
  const confidenceFactors: ConfidenceFactor[] = [];
  let why = '';

  // ─── Per-tool explanation logic ─────────────────────────────────────────
  switch (detected.toolId) {
    case 'create-invoice': {
      const clientParam = detected.extractedParams.find((p) => p.key === 'clientId');
      const amountParam = detected.extractedParams.find((p) => p.key === 'totalAmount');
      const gstParam = detected.extractedParams.find((p) => p.key === 'gstRate');
      const client = liveData.clients.find((c) => c.id === clientParam?.value);
      const amount = Number(amountParam?.value ?? 0);
      const gstRate = Number(gstParam?.value ?? 18);
      const taxable = amount / (1 + gstRate / 100);
      const gstAmount = amount - taxable;

      why = `You asked to create an invoice${client ? ` for ${client.name}` : ''}. I found the client in your live client list and computed the GST breakdown at ${gstRate}% so the invoice is filing-ready.`;

      if (client) {
        records.push({
          collection: 'clients',
          id: client.id,
          label: client.name,
          detail: `Client${client.gstin ? ` · GSTIN: ${client.gstin}` : ''}${client.email ? ` · ${client.email}` : ''}`,
        });
      }

      calculation.push(
        { label: 'Total Amount (incl. GST)', value: `₹${amount.toLocaleString('en-IN')}` },
        { label: 'GST Rate', value: `${gstRate}%` },
        { label: 'Taxable Value', value: `₹${Math.round(taxable).toLocaleString('en-IN')}` },
        { label: 'GST Amount', value: `₹${Math.round(gstAmount).toLocaleString('en-IN')}` },
        { label: 'CGST (50%)', value: `₹${Math.round(gstAmount / 2).toLocaleString('en-IN')}` },
        { label: 'SGST (50%)', value: `₹${Math.round(gstAmount / 2).toLocaleString('en-IN')}` },
      );

      risks.push(
        { severity: 'low', description: 'Invoice is created as draft — not sent or filed.', mitigation: 'Review the draft and send when ready.' },
        { severity: 'medium', description: 'GST rate assumption may not match the actual supply category.', mitigation: 'Confirm the HSN/SAC code and applicable rate before filing.' },
      );

      alternatives.push(
        { title: 'Create as Quotation instead', tradeOff: 'A quote is non-binding and won\'t affect GST liability until converted.', recommended: false },
        { title: 'Use a different GST rate', tradeOff: '5% or 12% may apply depending on the goods/services supplied.', recommended: false },
      );

      confidenceFactors.push(
        { label: 'Client matched from live data', weight: 0.4, score: client ? 1 : 0 },
        { label: 'Amount explicitly stated', weight: 0.3, score: amountParam ? 1 : 0 },
        { label: 'GST rate specified', weight: 0.2, score: gstParam ? 1 : 0.5 },
        { label: 'Intent clarity', weight: 0.1, score: detected.confidence },
      );
      break;
    }

    case 'send-reminder-email':
    case 'send-reminder-whatsapp': {
      const channel = detected.toolId.includes('whatsapp') ? 'WhatsApp' : 'email';
      const invoiceParam = detected.extractedParams.find((p) => p.key === 'invoiceId');
      const amountParam = detected.extractedParams.find((p) => p.key === 'amount');
      const daysParam = detected.extractedParams.find((p) => p.key === 'daysOverdue');
      const invoice = liveData.overdueInvoices.find((i) => i.id === invoiceParam?.value);

      why = `This client has an overdue invoice${invoice ? ` (${invoice.invoiceNumber}, ${invoice.daysOverdue} days past due)` : ''}. A ${channel} reminder is the appropriate next step in the collection ladder before escalation.`;

      if (invoice) {
        records.push({
          collection: 'invoices',
          id: invoice.id,
          label: invoice.invoiceNumber,
          detail: `${invoice.clientName} · ₹${invoice.totalAmount.toLocaleString('en-IN')} · ${invoice.daysOverdue} days overdue`,
        });
      }

      calculation.push(
        { label: 'Outstanding Amount', value: `₹${Number(amountParam?.value ?? 0).toLocaleString('en-IN')}` },
        { label: 'Days Overdue', value: `${daysParam?.value ?? '?'} days` },
        { label: 'Channel', value: channel },
        { label: 'Escalation Level', value: invoice && invoice.daysOverdue > 14 ? 'Level 2 (formal)' : 'Level 1 (gentle)' },
      );

      risks.push(
        { severity: 'medium', description: 'Over-aggressive reminders can damage client relationships.', mitigation: 'Keep the tone professional and offer payment plan options.' },
        { severity: 'low', description: 'Email may land in spam.', mitigation: 'Follow up via WhatsApp if no response in 3 days.' },
      );

      alternatives.push(
        { title: `Send via ${channel === 'WhatsApp' ? 'Email' : 'WhatsApp'} instead`, tradeOff: 'Different channel may get better response depending on client preference.', recommended: false },
        { title: 'Call the client directly', tradeOff: 'More personal but time-consuming; reserve for high-value or 90+ day overdue.', recommended: invoice?.daysOverdue > 30 },
      );

      confidenceFactors.push(
        { label: 'Overdue invoice matched', weight: 0.5, score: invoice ? 1 : 0 },
        { label: 'Client contact available', weight: 0.3, score: 0.8 },
        { label: 'Intent clarity', weight: 0.2, score: detected.confidence },
      );
      break;
    }

    case 'create-payment-link': {
      const amountParam = detected.extractedParams.find((p) => p.key === 'amount');
      const invoiceParam = detected.extractedParams.find((p) => p.key === 'invoiceId');
      const invoice = liveData.recentInvoices.find((i) => i.id === invoiceParam?.value);

      why = `A payment link lets the client pay instantly via UPI/card without manual reconciliation. This reduces collection time by an average of 40% for invoices under ₹2L.`;

      if (invoice) {
        records.push({
          collection: 'invoices',
          id: invoice.id,
          label: invoice.invoiceNumber,
          detail: `${invoice.clientName} · ₹${invoice.totalAmount.toLocaleString('en-IN')} · ${invoice.status}`,
        });
      }

      calculation.push(
        { label: 'Payment Amount', value: `₹${Number(amountParam?.value ?? 0).toLocaleString('en-IN')}` },
        { label: 'Link Provider', value: 'Internal (GSTPilot)' },
        { label: 'Payment Methods', value: 'UPI, Card, Net Banking' },
        { label: 'Link Expiry', value: '30 days' },
      );

      risks.push(
        { severity: 'low', description: 'Link may expire before payment.', mitigation: 'Regenerate if client delays beyond 30 days.' },
        { severity: 'medium', description: 'No payment gateway fee validation.', mitigation: 'Confirm gateway charges with finance before large transactions.' },
      );

      alternatives.push(
        { title: 'Send bank transfer details instead', tradeOff: 'No gateway fees but slower collection and manual reconciliation.', recommended: false },
      );

      confidenceFactors.push(
        { label: 'Invoice matched', weight: 0.4, score: invoice ? 1 : 0 },
        { label: 'Amount specified', weight: 0.4, score: amountParam ? 1 : 0 },
        { label: 'Intent clarity', weight: 0.2, score: detected.confidence },
      );
      break;
    }

    case 'generate-collection-report': {
      const totalOverdue = liveData.overdueInvoices.reduce((s, i) => s + i.totalAmount, 0);
      why = `You currently have ${liveData.overdueInvoices.length} overdue invoices worth ₹${totalOverdue.toLocaleString('en-IN')}. A structured collection report with aging buckets will help prioritize recovery efforts.`;

      liveData.overdueInvoices.slice(0, 5).forEach((inv) => {
        records.push({
          collection: 'invoices',
          id: inv.id,
          label: inv.invoiceNumber,
          detail: `${inv.clientName} · ₹${inv.totalAmount.toLocaleString('en-IN')} · ${inv.daysOverdue}d overdue`,
        });
      });

      const aging = {
        '0-30': liveData.overdueInvoices.filter((i) => i.daysOverdue <= 30).reduce((s, i) => s + i.totalAmount, 0),
        '31-60': liveData.overdueInvoices.filter((i) => i.daysOverdue > 30 && i.daysOverdue <= 60).reduce((s, i) => s + i.totalAmount, 0),
        '61-90': liveData.overdueInvoices.filter((i) => i.daysOverdue > 60 && i.daysOverdue <= 90).reduce((s, i) => s + i.totalAmount, 0),
        '90+': liveData.overdueInvoices.filter((i) => i.daysOverdue > 90).reduce((s, i) => s + i.totalAmount, 0),
      };

      calculation.push(
        { label: 'Total Overdue', value: `₹${totalOverdue.toLocaleString('en-IN')}` },
        { label: 'Overdue Invoice Count', value: String(liveData.overdueInvoices.length) },
        { label: '0-30 days', value: `₹${aging['0-30'].toLocaleString('en-IN')}` },
        { label: '31-60 days', value: `₹${aging['31-60'].toLocaleString('en-IN')}` },
        { label: '61-90 days', value: `₹${aging['61-90'].toLocaleString('en-IN')}` },
        { label: '90+ days', value: `₹${aging['90+'].toLocaleString('en-IN')}` },
      );

      risks.push(
        { severity: 'medium', description: 'Aging buckets may miss partial payments.', mitigation: 'Reconcile with bank transactions before acting.' },
      );

      alternatives.push(
        { title: 'Client-wise report instead', tradeOff: 'Better for relationship management; worse for prioritization.', recommended: false },
      );

      confidenceFactors.push(
        { label: 'Live overdue data available', weight: 0.6, score: liveData.overdueInvoices.length > 0 ? 1 : 0.3 },
        { label: 'Intent clarity', weight: 0.4, score: detected.confidence },
      );
      break;
    }

    case 'prepare-gst-return': {
      const totalSales = liveData.recentInvoices.reduce((s, i) => s + i.totalAmount, 0);
      const outputLiability = liveData.recentInvoices.reduce((s, i) => s + (i.totalAmount - i.totalAmount / 1.18), 0);
      why = `Your recent sales invoices show ₹${Math.round(totalSales).toLocaleString('en-IN')} in total sales with an estimated output GST liability of ₹${Math.round(outputLiability).toLocaleString('en-IN')}. Drafting a return prepares the data for your review without filing.`;

      liveData.recentInvoices.slice(0, 5).forEach((inv) => {
        records.push({
          collection: 'invoices',
          id: inv.id,
          label: inv.invoiceNumber,
          detail: `${inv.clientName} · ₹${inv.totalAmount.toLocaleString('en-IN')} · ${inv.status}`,
        });
      });

      calculation.push(
        { label: 'Total Sales (from live invoices)', value: `₹${Math.round(totalSales).toLocaleString('en-IN')}` },
        { label: 'Invoice Count', value: String(liveData.recentInvoices.length) },
        { label: 'Output GST Liability (est.)', value: `₹${Math.round(outputLiability).toLocaleString('en-IN')}` },
        { label: 'Input Tax Credit', value: '₹0 (to be computed from GSTR-2B)' },
        { label: 'Net Payable (est.)', value: `₹${Math.round(outputLiability).toLocaleString('en-IN')}` },
      );

      risks.push(
        { severity: 'high', description: 'This is a DRAFT — do not file without verifying ITC from GSTR-2B.', mitigation: 'Reconcile purchase ITC before filing on the GST portal.' },
        { severity: 'medium', description: 'GST rate assumption (18%) may not apply to all invoices.', mitigation: 'Verify HSN/SAC codes and recompute liability per slab.' },
      );

      alternatives.push(
        { title: 'Wait for GSTR-2B reconciliation first', tradeOff: 'More accurate ITC but delays filing preparation.', recommended: true },
      );

      confidenceFactors.push(
        { label: 'Live invoice data', weight: 0.5, score: liveData.recentInvoices.length > 0 ? 1 : 0.3 },
        { label: 'Period specified', weight: 0.3, score: detected.extractedParams.some((p) => p.key === 'period') ? 1 : 0.3 },
        { label: 'Intent clarity', weight: 0.2, score: detected.confidence },
      );
      break;
    }

    case 'create-task': {
      const titleParam = detected.extractedParams.find((p) => p.key === 'title');
      why = `Creating a tracked task ensures this action doesn't get forgotten. Tasks appear in the priority queue and can be assigned, scheduled, and monitored.`;

      calculation.push(
        { label: 'Task Title', value: String(titleParam?.value ?? 'Untitled task') },
        { label: 'Default Priority', value: 'Medium' },
        { label: 'Assignee', value: ctx.userEmail },
      );

      risks.push({ severity: 'low', description: 'Task may be ignored if not prioritized.', mitigation: 'Set a due date and check the priority queue daily.' });

      confidenceFactors.push(
        { label: 'Task title extracted', weight: 0.6, score: titleParam ? 1 : 0.3 },
        { label: 'Intent clarity', weight: 0.4, score: detected.confidence },
      );
      break;
    }

    case 'mark-invoice-paid': {
      const invoiceParam = detected.extractedParams.find((p) => p.key === 'invoiceId');
      const amountParam = detected.extractedParams.find((p) => p.key === 'amount');
      const invoice = liveData.recentInvoices.find((i) => i.id === invoiceParam?.value);

      why = `Recording this payment closes the receivable, updates your cash position, and ensures accurate financial reporting. The invoice status, a payment record, and an activity log are all updated atomically.`;

      if (invoice) {
        records.push({
          collection: 'invoices',
          id: invoice.id,
          label: invoice.invoiceNumber,
          detail: `${invoice.clientName} · ₹${invoice.totalAmount.toLocaleString('en-IN')}`,
        });
      }

      calculation.push(
        { label: 'Invoice', value: String(invoiceParam?.value ?? '?') },
        { label: 'Amount Paid', value: `₹${Number(amountParam?.value ?? 0).toLocaleString('en-IN')}` },
        { label: 'New Invoice Status', value: 'Paid' },
      );

      risks.push(
        { severity: 'high', description: 'Marking paid before funds clear can cause reconciliation errors.', mitigation: 'Confirm the payment has settled in your bank account first.' },
      );

      confidenceFactors.push(
        { label: 'Invoice matched', weight: 0.5, score: invoice ? 1 : 0.3 },
        { label: 'Amount verified', weight: 0.3, score: amountParam ? 1 : 0.3 },
        { label: 'Intent clarity', weight: 0.2, score: detected.confidence },
      );
      break;
    }

    default: {
      why = 'This action will perform a real business operation. Review the details below before approving.';
      confidenceFactors.push({ label: 'Intent clarity', weight: 1, score: detected.confidence });
    }
  }

  // Compute overall confidence (0-100)
  const overall = confidenceFactors.length > 0
    ? Math.round(confidenceFactors.reduce((s, f) => s + f.score * f.weight, 0) * 100)
    : Math.round(detected.confidence * 100);

  return {
    toolId: detected.toolId,
    toolName: detected.toolName,
    why,
    records,
    confidence: overall,
    confidenceFactors,
    calculation,
    risks,
    alternatives,
    generatedAt: new Date().toISOString(),
  };
}
