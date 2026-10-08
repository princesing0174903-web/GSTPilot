// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO AI CFO™ — Explainable Decision Card Builder
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

      why = `A payment link lets the client pay instantly via UPI/card without manual reconciliation. Oracle looks up the real invoice, validates it's unpaid, detects the connected provider (Razorpay/Stripe), and creates a REAL payment link via the provider API. The link is then emailed and WhatsApp'd to the customer, with webhook monitoring for automatic status updates.`;

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
        { label: 'Provider', value: 'Razorpay or Stripe (auto-detected from integrations)' },
        { label: 'Payment Methods', value: 'UPI, Card, Net Banking, Wallet, EMI' },
        { label: 'Link Expiry', value: '30 days' },
        { label: 'Delivery', value: 'Email + WhatsApp (if connected)' },
        { label: 'Webhook Monitoring', value: 'Paid / Failed / Expired / Refunded auto-update' },
      );

      risks.push(
        { severity: 'medium', description: 'No payment provider connected (preview mode).', mitigation: 'Go to Settings → Integrations → Razorpay or Stripe and add API credentials to create real links.' },
        { severity: 'low', description: 'Link may expire before payment.', mitigation: 'Regenerate if client delays beyond 30 days.' },
        { severity: 'low', description: 'Gateway fees apply (≈2% + ₹3).', mitigation: 'Fees are estimated in the approval summary before creation.' },
      );

      alternatives.push(
        { title: 'Send bank transfer details instead', tradeOff: 'No gateway fees but slower collection and manual reconciliation.', recommended: false },
        { title: 'Use the production Payment Link card', tradeOff: 'Type "Create a payment link for Invoice XXX" — Oracle opens a dedicated approval card with real provider integration.', recommended: true },
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

    case 'generate-gst-report': {
      const totalSales = liveData.recentInvoices.reduce((s, i) => s + i.totalAmount, 0);
      const periodParam = detected.extractedParams.find((p) => p.key === 'period');
      const reportTypeParam = detected.extractedParams.find((p) => p.key === 'reportType');
      const periodLabel =
        periodParam?.value === 'last' ? 'last month' :
        periodParam?.value === 'quarter' ? 'this quarter' :
        periodParam?.value === 'fy' ? 'this financial year' :
        'this month';
      const reportTypeLabel =
        reportTypeParam?.value === 'gstr-1' ? 'GSTR-1 (outward supplies)' :
        reportTypeParam?.value === 'gstr-3b' ? 'GSTR-3B (summary return)' :
        reportTypeParam?.value === 'sales-tax' ? 'sales tax breakdown' :
        reportTypeParam?.value === 'purchase-tax' ? 'purchase tax / ITC breakdown' :
        reportTypeParam?.value === 'gst-liability' ? 'GST liability focus' :
        'executive GST summary';

      why = `Generating a ${reportTypeLabel} report for ${periodLabel} pulls every live invoice in the period, validates GSTIN formats / duplicates / dates / reverse-charge flags, then computes per-slab CGST/SGST/IGST, ITC available + utilized, and net payable. Every number references a real invoice ID — no estimates, no simulations. The report is saved to the reports collection (version history) and downloadable as PDF / Excel / CSV.`;

      // Surface the recent sales invoices that will be in the report
      liveData.recentInvoices.slice(0, 5).forEach((inv) => {
        records.push({
          collection: 'invoices',
          id: inv.id,
          label: inv.invoiceNumber,
          detail: `${inv.clientName} · ₹${inv.totalAmount.toLocaleString('en-IN')} · ${inv.status}`,
        });
      });

      // Estimate output tax assuming 18% flat (the real engine computes per-slab)
      const estOutputTax = Math.round(totalSales - totalSales / 1.18);

      calculation.push(
        { label: 'Report Type', value: reportTypeLabel },
        { label: 'Period', value: periodLabel },
        { label: 'Live Invoices in Scope', value: String(liveData.recentInvoices.length) },
        { label: 'Total Sales (live, recent)', value: `₹${totalSales.toLocaleString('en-IN')}` },
        { label: 'Est. Output GST (18% proxy)', value: `₹${estOutputTax.toLocaleString('en-IN')} — actual computed per-slab on execution` },
        { label: 'Validation Checks', value: 'GSTIN format, duplicates, future dates, tax split, RCM, exempt, zero-rated, export' },
        { label: 'Outputs', value: 'Per-slab CGST/SGST/IGST/Cess, ITC, net payable, top customers/vendors, monthly comparison, insights' },
        { label: 'Download Formats', value: 'PDF · Excel · CSV' },
      );

      risks.push(
        { severity: 'medium', description: 'Estimate shown here assumes 18% flat GST — the actual report uses each invoice\'s real GST slab.', mitigation: 'Approve to run the full per-slab calculation against live invoice data.' },
        { severity: 'low', description: 'Preview-mode permission may block saving the report to Firestore.', mitigation: 'The report is still returned in-memory for download — sign in to persist.' },
      );

      alternatives.push(
        { title: 'Draft a GST return instead', tradeOff: 'A return prepares a filing-ready payload; a report is a downloadable analysis. Use prepare-gst-return if you want to file.', recommended: false },
        { title: 'Different period', tradeOff: 'Last month / quarter / FY available — pick the one matching your filing cycle.', recommended: false },
      );

      confidenceFactors.push(
        { label: 'Live invoice data available', weight: 0.5, score: liveData.recentInvoices.length > 0 ? 1 : 0.3 },
        { label: 'Report type specified', weight: 0.25, score: reportTypeParam ? 1 : 0.5 },
        { label: 'Period specified', weight: 0.15, score: periodParam ? 1 : 0.5 },
        { label: 'Intent clarity', weight: 0.1, score: detected.confidence },
      );
      break;
    }

    case 'send-communication': {
      const channelParam = detected.extractedParams.find((p) => p.key === 'channel');
      const typeParam = detected.extractedParams.find((p) => p.key === 'messageType');
      const recipientParam = detected.extractedParams.find((p) => p.key === 'recipient');
      const channelLabel = channelParam?.value === 'whatsapp' ? 'WhatsApp' :
                           channelParam?.value === 'both' ? 'Email + WhatsApp' :
                           'Email';
      const typeLabel = typeParam?.value === 'payment_link' ? 'a payment link' :
                        typeParam?.value === 'gst_report' ? 'this month\'s GST report' :
                        typeParam?.value === 'invoice' ? 'an invoice' :
                        typeParam?.value === 'payment_reminder' ? 'a payment reminder' :
                        typeParam?.value === 'receipt' ? 'a payment receipt' :
                        typeParam?.value === 'outstanding_statement' ? 'an outstanding statement' :
                        typeParam?.value === 'welcome' ? 'a welcome email' :
                        typeParam?.value === 'compliance_reminder' ? 'a compliance reminder' :
                        'a custom message';

      why = `Sending ${typeLabel} via ${channelLabel} resolves the recipient from the real clients database, validates their email/phone + active status + communication preferences, detects the connected provider (SMTP/Resend/SendGrid/Gmail/Mailgun for email; WhatsApp Cloud API/Twilio/Gupshup for WhatsApp), generates a branded message with dynamic placeholders, attaches the relevant document (invoice PDF / GST report PDF / payment link), and dispatches via the provider's REAL API. Delivery is tracked through provider webhooks — Sent / Delivered / Opened / Clicked / Bounced / Failed for email; Sent / Delivered / Read / Failed for WhatsApp. Failed sends retry automatically with exponential backoff.`;

      if (recipientParam) {
        records.push({
          collection: 'clients',
          id: String(recipientParam.value),
          label: String(recipientParam.value),
          detail: `Resolved from live clients database · ${channelLabel}`,
        });
      } else {
        records.push({
          collection: 'clients',
          id: '(auto-resolved)',
          label: 'Recipient will be resolved from message',
          detail: 'Oracle looks up the customer by name, email, or phone in the real clients collection',
        });
      }

      calculation.push(
        { label: 'Delivery Channel', value: channelLabel },
        { label: 'Message Type', value: typeLabel },
        { label: 'Email Provider', value: 'SMTP / Resend / SendGrid / Gmail / Mailgun (auto-detected from integrations)' },
        { label: 'WhatsApp Provider', value: 'WhatsApp Cloud API / Twilio / Gupshup (auto-detected)' },
        { label: 'Message Generation', value: 'Branded HTML email + plain-text WhatsApp template with dynamic placeholders' },
        { label: 'Attachments', value: 'Invoice PDF · GST Report PDF · Payment Link (auto-generated from real data)' },
        { label: 'Webhook Tracking', value: 'Sent / Delivered / Opened / Clicked / Bounced / Failed (email); Sent / Delivered / Read / Failed (WhatsApp)' },
        { label: 'Retry Engine', value: 'Exponential backoff (2s, 4s, 8s, 16s, 32s) up to 5 attempts for transient failures' },
      );

      risks.push(
        { severity: 'medium', description: 'No email/WhatsApp provider connected (preview mode).', mitigation: 'Go to Settings → Integrations → Email or WhatsApp and add real provider credentials to dispatch messages.' },
        { severity: 'low', description: 'Recipient may have opted out of the channel.', mitigation: 'Oracle checks communication preferences and warns before sending.' },
        { severity: 'low', description: 'Provider may rate-limit or temporarily fail.', mitigation: 'Retry engine automatically re-attempts with exponential backoff; escalates after 5 failed attempts.' },
      );

      alternatives.push(
        { title: 'Send via a different channel', tradeOff: 'Email is more formal and supports attachments; WhatsApp is faster and has higher open rates.', recommended: false },
        { title: 'Use the production Communication card', tradeOff: 'Type "Email the GST report to ABC Traders" or "WhatsApp the payment link" — Oracle opens a dedicated approval card with real provider integration.', recommended: true },
      );

      confidenceFactors.push(
        { label: 'Channel specified', weight: 0.4, score: channelParam ? 1 : 0.3 },
        { label: 'Message type specified', weight: 0.3, score: typeParam ? 1 : 0.5 },
        { label: 'Recipient resolved', weight: 0.2, score: recipientParam ? 1 : 0.4 },
        { label: 'Intent clarity', weight: 0.1, score: detected.confidence },
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
