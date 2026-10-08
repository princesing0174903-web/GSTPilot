// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO AI Intelligence Engine — Deadlines Analyzer
//
// Merges deadline signals from multiple sources:
//   • GST notice response dates
//   • GSTR-1 / GSTR-3B statutory due dates
//   • Invoice due dates (receivables) — only flagged if within 7 days
//
// Emits one signal per upcoming deadline. The ranker will prioritise the most
// urgent ones.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import type { Analyzer, AnalyzerResult, Signal } from '../types';
import { getDataset } from '../types';
import type { GstData, InvoicesData } from '../types';

const DAY_MS = 24 * 60 * 60 * 1000;

function daysTo(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.ceil((t - Date.now()) / DAY_MS);
}

function isoDueDate(dayOfMonth: number, now = new Date()): string {
  // The next occurrence of `dayOfMonth` (this month if not yet passed, else next month).
  const candidate = new Date(now.getFullYear(), now.getMonth(), dayOfMonth);
  if (candidate.getTime() < now.getTime()) {
    return new Date(now.getFullYear(), now.getMonth() + 1, dayOfMonth).toISOString();
  }
  return candidate.toISOString();
}

export const deadlinesAnalyzer: Analyzer = {
  id: 'deadlines',
  label: 'Deadlines',
  async analyze(dataset): Promise<AnalyzerResult> {
    // (async because we read the ComplianceDeadline table mid-analysis)
    const signals: Signal[] = [];
    const metrics: Record<string, number> = {};

    const gst = getDataset<GstData>(dataset, 'gst');
    const invoices = getDataset<InvoicesData>(dataset, 'invoices');

    const upcomingDeadlines: number[] = [];
    const overdueDeadlines: number[] = [];

    // ── Statutory GST due dates (always emitted, even if no GST data) ────────
    const gstr1Due = isoDueDate(11);
    const gstr3bDue = isoDueDate(20);
    const d1 = daysTo(gstr1Due);
    const d2 = daysTo(gstr3bDue);

    if (d1 !== null) {
      metrics.gstr1DueInDays = d1;
      if (d1 <= 7) upcomingDeadlines.push(d1);
    }
    if (d2 !== null) {
      metrics.gstr3bDueInDays = d2;
      if (d2 <= 7) upcomingDeadlines.push(d2);
    }

    // GSTR-1 due within 7 days
    if (d1 !== null && d1 <= 7) {
      const severity = d1 <= 0 ? 'critical' : d1 <= 3 ? 'high' : 'medium';
      signals.push({
        id: 'deadlines:gstr1-due',
        kind: 'problem',
        category: 'deadline',
        severity,
        title: `GSTR-1 due in ${d1 < 0 ? `${Math.abs(d1)} day(s) (overdue)` : `${d1} day(s)`}`,
        description: `GSTR-1 statutory due date is ${new Date(gstr1Due).toLocaleDateString('en-IN')}. Late filing attracts ₹50/day late fee and blocks buyer ITC.`,
        recommendation: 'Prepare and file GSTR-1 immediately to avoid late fees and buyer ITC denial.',
        monetaryValue: Math.abs(d1) * 50,
        dueDate: gstr1Due,
        confidence: 0.95,
        evidence: [{ source: 'gst', reference: 'GSTR-1 statutory due (Rule 6)' }],
        analyzer: 'deadlines',
        tags: { daysToDue: d1 },
      });
    }

    // GSTR-3B due within 7 days
    if (d2 !== null && d2 <= 7) {
      const severity = d2 <= 0 ? 'critical' : d2 <= 3 ? 'high' : 'medium';
      const liability = gst?.totals.outputTaxLiability ?? 0;
      signals.push({
        id: 'deadlines:gstr3b-due',
        kind: 'problem',
        category: 'deadline',
        severity,
        title: `GSTR-3B due in ${d2 < 0 ? `${Math.abs(d2)} day(s) (overdue)` : `${d2} day(s)`}`,
        description: `GSTR-3B statutory due date is ${new Date(gstr3bDue).toLocaleDateString('en-IN')}.${liability > 0 ? ` Output tax liability of ₹${liability.toLocaleString('en-IN')} attracts 18% p.a. interest under Section 50 until filed.` : ''}`,
        recommendation: 'File GSTR-3B immediately to stop interest accrual and late fees.',
        monetaryValue: liability,
        dueDate: gstr3bDue,
        confidence: 0.95,
        evidence: [{ source: 'gst', reference: 'GSTR-3B statutory due (Rule 6)' }],
        analyzer: 'deadlines',
        tags: { daysToDue: d2 },
      });
    }

    // ── GST notice response deadlines ───────────────────────────────────────
    if (gst) {
      for (const notice of gst.notices.filter((n) => n.status === 'open' && n.dueDate)) {
        const d = daysTo(notice.dueDate);
        if (d === null) continue;
        if (d <= 14) {
          if (d < 0) overdueDeadlines.push(d);
          else upcomingDeadlines.push(d);
          const severity = d <= 0 ? 'critical' : d <= 3 ? 'high' : 'medium';
          signals.push({
            id: `deadlines:notice:${notice.id}`,
            kind: 'problem',
            category: 'deadline',
            severity,
            title: `GST notice response due ${d < 0 ? `${Math.abs(d)} day(s) overdue` : `in ${d} day(s)`}`,
            description: `${notice.noticeType} (${notice.noticeNumber ?? 'no number'}) — “${notice.subject}”. Response due ${new Date(notice.dueDate!).toLocaleDateString('en-IN')}.`,
            recommendation: 'File a detailed reply before the due date; engage a CA if the notice is a SCN or DRC-01.',
            monetaryValue: 0,
            dueDate: notice.dueDate,
            confidence: 0.95,
            evidence: [{ source: 'gst', reference: notice.noticeNumber ?? notice.subject }],
            analyzer: 'deadlines',
            tags: { daysToDue: d, noticeId: notice.id },
          });
        }
      }
    }

    // ── Invoice due dates within 7 days (collection reminders) ──────────────
    if (invoices) {
      for (const inv of invoices.invoices) {
        if (inv.paymentStatus === 'paid') continue;
        if (inv.balanceAmount <= 0) continue;
        const d = daysTo(inv.dueDate);
        if (d === null) continue;
        if (d <= 7 && d >= -3) {
          upcomingDeadlines.push(d);
          const severity = d <= 0 ? 'high' : 'medium';
          signals.push({
            id: `deadlines:invoice:${inv.id}`,
            kind: 'problem',
            category: 'deadline',
            severity,
            title: `Invoice ${inv.invoiceNumber} ${d < 0 ? `was due ${Math.abs(d)} day(s) ago` : `due in ${d} day(s)`}`,
            description: `${inv.buyerName ?? 'Customer'} — ₹${inv.balanceAmount.toLocaleString('en-IN')} balance, due ${inv.dueDate}.`,
            recommendation: d <= 0 ? 'Send a firm overdue reminder with a payment link today.' : 'Send a polite pre-due reminder now.',
            monetaryValue: inv.balanceAmount,
            dueDate: inv.dueDate,
            confidence: 0.9,
            evidence: [{ source: 'invoices', reference: `Invoice ${inv.invoiceNumber}` }],
            analyzer: 'deadlines',
            tags: { daysToDue: d, invoiceId: inv.id },
          });
        }
      }
    }

    // ── ComplianceDeadline table (country-wide statutory calendar) ──────────
    try {
      const deadlines = await db.complianceDeadline.findMany({
        where: { isActive: true, countryIso: 'IN' },
        take: 50,
      });
      for (const dl of deadlines) {
        if (!dl.dueDateRule) continue;
        // dueDateRule may be like "11", "20", or "MM-DD". Coerce into an upcoming date.
        const dayMatch = /^(\d{1,2})$/.exec(dl.dueDateRule);
        if (!dayMatch) continue;
        const day = Number(dayMatch[1]);
        if (day < 1 || day > 31) continue;
        const due = isoDueDate(day);
        const d = daysTo(due);
        if (d === null) continue;
        if (d <= 7) {
          upcomingDeadlines.push(d);
          const severity = d <= 0 ? 'critical' : d <= 3 ? 'high' : 'medium';
          signals.push({
            id: `deadlines:compliance:${dl.id}`,
            kind: 'problem',
            category: 'deadline',
            severity,
            title: `${dl.title} due in ${d < 0 ? `${Math.abs(d)} day(s) (overdue)` : `${d} day(s)`}`,
            description: `${dl.regulationType.toUpperCase()} compliance — ${dl.description ?? dl.title}.${dl.penaltyLate ? ` Late penalty: ${dl.penaltyLate}.` : ''}`,
            recommendation: 'Review the filing requirements and assign ownership for preparation.',
            monetaryValue: 0,
            dueDate: due,
            confidence: 0.7,
            evidence: [{ source: 'gst', reference: dl.title }],
            analyzer: 'deadlines',
            tags: { daysToDue: d, regulationType: dl.regulationType },
          });
        }
      }
    } catch {
      // ComplianceDeadline table may not exist or be empty — non-fatal.
    }

    metrics.upcomingDeadlines7d = upcomingDeadlines.filter((d) => d >= 0).length;
    metrics.overdueDeadlines = overdueDeadlines.length;

    return { analyzer: 'deadlines', signals, metrics };
  },
};
