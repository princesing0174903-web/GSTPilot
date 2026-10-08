// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO AI Intelligence Engine — Receivables Analyzer
//
// Inspects sales invoices to detect overdue receivables, aging buckets, and
// the top overdue customers who account for most of the at-risk balance.
// Emits one signal per top overdue invoice plus an aggregate signal.
// ═══════════════════════════════════════════════════════════════════════════════

import type { Analyzer, AnalyzerResult, Signal } from '../types';
import { getDataset } from '../types';
import type { InvoicesData, InvoiceSummary } from '../types';

function daysOverdue(invoice: InvoiceSummary): number {
  if (!invoice.dueDate) {
    // No due date → use paymentStatus as a hint.
    return invoice.paymentStatus === 'overdue' ? 30 : 0;
  }
  const due = Date.parse(invoice.dueDate);
  if (Number.isNaN(due)) return 0;
  const diff = Date.now() - due;
  return diff > 0 ? Math.floor(diff / (24 * 60 * 60 * 1000)) : 0;
}

function agingBucket(days: number): '0-30' | '31-60' | '61-90' | '90+' {
  if (days <= 30) return '0-30';
  if (days <= 60) return '31-60';
  if (days <= 90) return '61-90';
  return '90+';
}

export const receivablesAnalyzer: Analyzer = {
  id: 'receivables',
  label: 'Receivables',
  analyze(dataset): AnalyzerResult {
    const signals: Signal[] = [];
    const metrics: Record<string, number> = {};

    const invoices = getDataset<InvoicesData>(dataset, 'invoices');

    const totalOutstanding = invoices?.totals.salesOutstanding ?? 0;
    const overdueAmount = invoices?.totals.overdueAmount ?? 0;

    metrics.totalOutstanding = totalOutstanding;
    metrics.overdueAmount = overdueAmount;

    if (!invoices) {
      return { analyzer: 'receivables', signals, metrics };
    }

    const overdueInvoices = invoices.invoices
      .filter((i) => i.paymentStatus !== 'paid' && i.balanceAmount > 0)
      .map((i) => ({ inv: i, days: daysOverdue(i) }))
      .filter((x) => x.days > 0)
      .sort((a, b) => b.inv.balanceAmount - a.inv.balanceAmount);

    const aging = { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };
    for (const { inv, days } of overdueInvoices) {
      aging[agingBucket(days)] += inv.balanceAmount;
    }
    metrics.aging0to30 = aging['0-30'];
    metrics.aging31to60 = aging['31-60'];
    metrics.aging61to90 = aging['61-90'];
    metrics.aging90plus = aging['90+'];
    metrics.overdueCount = overdueInvoices.length;

    // ── Aggregate signal: total overdue ─────────────────────────────────────
    if (overdueAmount > 0) {
      const ninetyPlus = aging['90+'];
      const severity = ninetyPlus > overdueAmount * 0.3 ? 'critical' : overdueAmount > totalOutstanding * 0.5 ? 'high' : 'medium';
      signals.push({
        id: 'receivables:overdue-aggregate',
        kind: 'problem',
        category: 'receivables',
        severity,
        title: `${overdueInvoices.length} overdue invoice${overdueInvoices.length === 1 ? '' : 's'} totalling ₹${overdueAmount.toLocaleString('en-IN')}`,
        description: `Of ₹${totalOutstanding.toLocaleString('en-IN')} outstanding, ₹${overdueAmount.toLocaleString('en-IN')} is past due. Aging: 0-30d ₹${aging['0-30'].toLocaleString('en-IN')} · 31-60d ₹${aging['31-60'].toLocaleString('en-IN')} · 61-90d ₹${aging['61-90'].toLocaleString('en-IN')} · 90+d ₹${aging['90+'].toLocaleString('en-IN')}.`,
        recommendation: 'Prioritise the 90+ bucket for legal escalation; send firm reminders to the 31-60 bucket this week.',
        monetaryValue: overdueAmount,
        dueDate: null,
        confidence: 0.9,
        evidence: overdueInvoices.slice(0, 3).map(({ inv }) => ({
          source: 'invoices',
          reference: `Invoice ${inv.invoiceNumber}`,
        })),
        analyzer: 'receivables',
        tags: { ...aging },
      });
    }

    // ── Per-invoice signals for the top 3 overdue ───────────────────────────
    for (const { inv, days } of overdueInvoices.slice(0, 3)) {
      const severity = days > 90 ? 'high' : days > 60 ? 'medium' : 'low';
      signals.push({
        id: `receivables:overdue:${inv.id}`,
        kind: 'problem',
        category: 'receivables',
        severity,
        title: `Invoice ${inv.invoiceNumber} overdue by ${days} days`,
        description: `${inv.buyerName ?? 'Customer'} owes ₹${inv.balanceAmount.toLocaleString('en-IN')} on invoice ${inv.invoiceNumber}, due ${inv.dueDate ?? 'n/a'}.`,
        recommendation:
          days > 90
            ? 'Escalate to a legal notice; withhold further supplies to this customer.'
            : 'Send a firm reminder with the overdue statement and a payment link.',
        monetaryValue: inv.balanceAmount,
        dueDate: inv.dueDate,
        confidence: 0.95,
        evidence: [{ source: 'invoices', reference: `Invoice ${inv.invoiceNumber}` }],
        analyzer: 'receivables',
        tags: { daysOverdue: days },
      });
    }

    // ── Opportunity: outstanding but not overdue — accelerate collection ────
    const notYetOverdue = totalOutstanding - overdueAmount;
    if (notYetOverdue > 0 && overdueAmount === 0) {
      signals.push({
        id: 'receivables:accelerate-not-overdue',
        kind: 'opportunity',
        category: 'receivables',
        severity: 'low',
        title: `${invoices.invoices.filter((i) => i.paymentStatus === 'unpaid').length} invoices are due soon — accelerate collection`,
        description: `₹${notYetOverdue.toLocaleString('en-IN')} in receivables is outstanding but not yet overdue. Proactive reminders can pull cash forward by 7-10 days.`,
        recommendation: 'Send payment reminders 3 days before each due date and offer a 1% early-payment discount.',
        monetaryValue: notYetOverdue,
        dueDate: null,
        confidence: 0.7,
        evidence: [{ source: 'invoices', reference: 'Upcoming-due sales invoices' }],
        analyzer: 'receivables',
      });
    }

    return { analyzer: 'receivables', signals, metrics };
  },
};
